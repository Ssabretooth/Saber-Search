"""
Cross-reference tenders.winning_company against financial_disclosures.counterparty
to generate procurement_relationship flags.

Matching uses three tiers:
  1. Exact match after normalisation (strip legal suffixes, punctuation, lowercase)
  2. Token-set fuzzy match ≥ 88 (handles word-order and partial-name variants)
  3. Anchored token overlap: all significant tokens of the shorter name appear
     in the longer name (catches "Khula Logistics" inside "Khula Logistics (Pty) Ltd")

Flags are written to review_flags with flag_type='procurement_relationship'.
"""

import os
import re
import sys
from difflib import SequenceMatcher
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

# ── normalisation ─────────────────────────────────────────────────────────────

_LEGAL = re.compile(
    r"\b(pty\.?\s*ltd\.?|ltd\.?|inc\.?|llc\.?|cc\.?|npc\.?|soc\.?|rf\.?|"
    r"proprietary|limited|incorporated|trading\s+as|t/a|ta\b|and\s+associates?|"
    r"and\s+co\.?|& co\.?|& associates?|group\.?|holdings?\.?|enterprises?\.?|"
    r"solutions?\.?|services?\.?|consulting\.?|consultants?\.?|"
    r"construction\.?|contractors?\.?|suppliers?\.?|investments?\.?)\b",
    re.I,
)
_PUNCT = re.compile(r"[^\w\s]")
_SPACE = re.compile(r"\s+")

# Stop-words that add no matching signal
_STOP = {
    "the", "of", "and", "for", "in", "at", "by", "to", "a", "an",
    # South African geographic noise
    "south", "africa", "african", "national", "government", "municipal",
}


def normalise(name: str) -> str:
    name = name.lower()
    name = _LEGAL.sub(" ", name)
    name = _PUNCT.sub(" ", name)
    name = _SPACE.sub(" ", name).strip()
    return name


def token_set(name: str) -> set[str]:
    return {t for t in normalise(name).split() if t not in _STOP and len(t) > 1}


def similarity(a: str, b: str) -> float:
    na, nb = normalise(a), normalise(b)
    return SequenceMatcher(None, na, nb).ratio()


def token_overlap(a_tokens: set[str], b_tokens: set[str]) -> float:
    if not a_tokens or not b_tokens:
        return 0.0
    shorter = a_tokens if len(a_tokens) <= len(b_tokens) else b_tokens
    longer  = b_tokens if len(a_tokens) <= len(b_tokens) else a_tokens
    return len(shorter & longer) / len(shorter)


def is_match(tender_name: str, disclosure_name: str) -> tuple[bool, str]:
    """Return (matched, reason)."""
    tn = normalise(tender_name)
    dn = normalise(disclosure_name)

    # Tier 1: exact normalised match
    if tn == dn:
        return True, "exact"

    # Skip very short names — too many false positives
    if len(tn) < 6 or len(dn) < 6:
        return False, ""

    # Tier 2: fuzzy similarity ≥ 0.88
    score = SequenceMatcher(None, tn, dn).ratio()
    if score >= 0.88:
        return True, f"fuzzy({score:.2f})"

    # Tier 3: all significant tokens of the shorter appear in longer
    # Require ≥ 3 meaningful tokens to avoid generic phrases like "South Africa"
    tt, dt = token_set(tender_name), token_set(disclosure_name)
    overlap = token_overlap(tt, dt)
    shorter_len = min(len(tt), len(dt))
    if shorter_len >= 3 and overlap >= 1.0:
        return True, "token-overlap"

    return False, ""


# ── load data ─────────────────────────────────────────────────────────────────

print("Loading tenders…")
tenders_raw: list[dict] = []
PAGE = 1000
offset = 0
while True:
    batch = (
        sb.table("tenders")
        .select("id, ocid, title, winning_company, amount_zar, award_date, department")
        .range(offset, offset + PAGE - 1)
        .execute()
    ).data or []
    tenders_raw.extend(batch)
    if len(batch) < PAGE:
        break
    offset += PAGE
print(f"  {len(tenders_raw)} tenders")

print("Loading disclosures with counterparties…")
disc_raw: list[dict] = []
PAGE = 1000
offset = 0
while True:
    batch = (
        sb.table("financial_disclosures")
        .select("id, mp_id, category, counterparty, description")
        .not_.is_("counterparty", "null")
        .range(offset, offset + PAGE - 1)
        .execute()
    ).data or []
    disc_raw.extend(batch)
    if len(batch) < PAGE:
        break
    offset += PAGE
print(f"  {len(disc_raw)} disclosures with counterparty")

print("Loading MP names…")
mps_raw = (
    sb.table("mps")
    .select("id, full_name, party")
    .execute()
).data or []
mp_by_id = {m["id"]: m for m in mps_raw}

# ── matching ──────────────────────────────────────────────────────────────────

print("\nRunning cross-reference…")
flags: list[dict] = []
seen: set[tuple] = set()  # (mp_id, tender_id)

for disc in disc_raw:
    cpty = disc["counterparty"]
    if not cpty or len(cpty.strip()) < 4:
        continue

    for tender in tenders_raw:
        matched, reason = is_match(tender["winning_company"], cpty)
        if not matched:
            continue

        mp_id = disc["mp_id"]
        tender_id = tender["id"]
        key = (mp_id, tender_id)
        if key in seen:
            continue
        seen.add(key)

        mp = mp_by_id.get(mp_id, {})
        amount = tender.get("amount_zar")
        amount_str = f"R{int(float(amount)):,}" if amount else "unknown amount"
        flags.append({
            "flag_type": "procurement_relationship",
            "subject_type": "mp",
            "subject_id": mp_id,
            "rule_id": "tender_disclosure_match",
            "rule_version": "1.0",
            "public_text": (
                f"{mp.get('full_name', 'Unknown MP')} has a {disc['category']} interest in "
                f"{cpty!r}, which was awarded a government tender worth {amount_str} "
                f"by {tender.get('department', 'a department')}."
            ),
            "inputs": {
                "tender_id": tender_id,
                "disclosure_id": disc["id"],
                "match_reason": reason,
                "tender_company": tender["winning_company"],
                "disclosure_counterparty": cpty,
                "disclosure_category": disc["category"],
                "tender_amount_zar": str(tender["amount_zar"]) if tender["amount_zar"] else None,
                "award_date": str(tender["award_date"]) if tender["award_date"] else None,
                "department": tender["department"],
                "tender_title": tender["title"],
                "mp_name": mp.get("full_name"),
                "mp_party": mp.get("party"),
            },
        })

print(f"  {len(flags)} potential procurement relationships found")

if not flags:
    print("No matches — nothing to write.")
    sys.exit(0)

# ── preview ───────────────────────────────────────────────────────────────────

print("\n── Top matches ──")
for f in flags[:20]:
    inp = f["inputs"]
    print(
        f"  {inp['mp_name']!r:40s}  "
        f"{inp['disclosure_counterparty']!r:35s}  ↔  "
        f"{inp['tender_company']!r:35s}  "
        f"[{inp['match_reason']}]  "
        f"R{inp['tender_amount_zar'] or '?'}"
    )

# ── apply ─────────────────────────────────────────────────────────────────────

if "--apply" not in sys.argv:
    print("\nDry run. Pass --apply to write flags.")
    sys.exit(0)

print("\nWriting flags…")
# Partial-index conflict (subject_id, inputs->>'tender_id') where flag_type=procurement_relationship
# can't be expressed via client upsert — check existence and insert individually.
existing = {
    (r["subject_id"], r["inputs"]["tender_id"])
    for r in (
        sb.table("review_flags")
        .select("subject_id, inputs")
        .eq("flag_type", "procurement_relationship")
        .execute()
    ).data or []
}

written = 0
skipped_null = 0
for flag in flags:
    if flag["subject_id"] is None:
        skipped_null += 1
        continue
    key = (flag["subject_id"], flag["inputs"]["tender_id"])
    if key in existing:
        continue
    sb.table("review_flags").insert(flag).execute()
    existing.add(key)
    written += 1
    mp = flag["inputs"].get("mp_name", "?")
    company = flag["inputs"]["tender_company"]
    print(f"  ✓ {mp} ↔ {company}")

print(f"\nDone. {written} new flags, {skipped_null} skipped (no canonical MP).")
