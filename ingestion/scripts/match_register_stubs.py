"""
Re-link financial_disclosures whose mp_id points to a register stub
(party IS NULL, term_start IS NULL) to the matching canonical MP.

Matching strategy:
  1. Normalize titles in stub name (Doctor→Dr., Reverend→Rev., etc.)
  2. Try exact match against canonical names (case-insensitive)
  3. Try honorific-stripped surname+forename match for remaining stubs
  4. If unique match: UPDATE disclosures SET mp_id = canonical_id,
     then DELETE stub (if it has no other references)
"""

import os
import re
import sys
from difflib import SequenceMatcher
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

# ── title normalisation ──────────────────────────────────────────────────────

TITLE_MAP = [
    (r"\bDoctor\b",        "Dr."),
    (r"\bReverend\b",      "Rev."),
    (r"\bProfessor\b",     "Prof."),
    (r"\bMajor General\b", "Maj. Gen."),
    (r"\bBrigadier\b",     "Brig."),
    (r"\bGeneral\b",       "Gen."),
    (r"\bAdmiral\b",       "Adm."),
]

def normalise(name: str) -> str:
    for pat, repl in TITLE_MAP:
        name = re.sub(pat, repl, name, flags=re.IGNORECASE)
    return name.strip()

def strip_honorific(name: str) -> str:
    """Remove all standard honorific prefixes (including titles of nobility/rank)."""
    return re.sub(
        r"^(Mr\.|Mrs\.|Ms\.|Miss\.|Dr\.|Prof\.|Rev\.|Maj\. Gen\.|Brig\.|Gen\.|Adm\.|Prince|Princess|Chief)\s*",
        "", name, flags=re.IGNORECASE
    ).strip()

def clean_name(name: str) -> str:
    """Remove parenthetical additions like 'Izaks (Lucas)'."""
    return re.sub(r"\s*\([^)]*\)", "", name).strip()

def surname_key(name: str) -> str:
    """'Mulder, Dr. Cornelius Petrus' → 'mulder cornelius petrus'"""
    plain = strip_honorific(clean_name(name))
    # Normalise "Mc Gluwa" → "mcgluwa" spacing
    plain = re.sub(r"\bMc\s+", "Mc", plain)
    if "," in plain:
        parts = plain.split(",", 1)
        return (parts[0].strip() + " " + parts[1].strip()).lower()
    return plain.lower()

def surname_first_forename(name: str) -> str:
    """'Letsike, Ms. Mmapaseka Steve Emily' → 'letsike mmapaseka'"""
    plain = clean_name(normalise(name))
    plain = re.sub(r"\bMc\s+", "Mc", plain)
    if "," in plain:
        parts = plain.split(",", 1)
        # Strip honorific embedded after the comma: "Adams, Mrs. Rachel" → "rachel"
        forename_part = strip_honorific(parts[1].strip())
        forenames = forename_part.split()
        first = forenames[0] if forenames else ""
        return (parts[0].strip() + " " + first).lower()
    tokens = plain.split()
    # Firstname Lastname format
    return (tokens[-1] + " " + tokens[0]).lower() if len(tokens) >= 2 else plain.lower()

# ── load data ────────────────────────────────────────────────────────────────

print("Loading stubs (party IS NULL, term_start IS NULL with disclosures)…")
# All distinct stub mp_ids referenced by disclosures
stub_res = sb.rpc("", {}).select() if False else None  # placeholder
# Direct SQL via execute_sql not available in client — use table API
stubs_raw = (
    sb.table("mps")
    .select("id, full_name, chamber")
    .is_("party", "null")
    .is_("term_start", "null")
    .execute()
).data or []

# Only keep stubs that have disclosures
disc_mp_ids_raw = (
    sb.table("financial_disclosures")
    .select("mp_id")
    .execute()
).data or []
disc_mp_ids = {r["mp_id"] for r in disc_mp_ids_raw}

stubs = [s for s in stubs_raw if s["id"] in disc_mp_ids]
print(f"  {len(stubs)} stubs with disclosures")

print("Loading canonical MPs (party IS NOT NULL)…")
canonical_raw: list[dict] = []
PAGE = 1000
offset = 0
while True:
    batch = (
        sb.table("mps")
        .select("id, full_name, party, chamber, term_start")
        .not_.is_("party", "null")
        .range(offset, offset + PAGE - 1)
        .execute()
    ).data or []
    canonical_raw.extend(batch)
    if len(batch) < PAGE:
        break
    offset += PAGE
print(f"  {len(canonical_raw)} canonical MPs loaded")

# Build lookup indexes
canonical_by_lower: dict[str, list[dict]] = {}
for c in canonical_raw:
    key = c["full_name"].strip().lower()
    canonical_by_lower.setdefault(key, []).append(c)

canonical_by_norm: dict[str, list[dict]] = {}
for c in canonical_raw:
    key = normalise(c["full_name"]).strip().lower()
    canonical_by_norm.setdefault(key, []).append(c)

canonical_by_surname: dict[str, list[dict]] = {}
for c in canonical_raw:
    key = surname_key(c["full_name"])
    canonical_by_surname.setdefault(key, []).append(c)

canonical_by_sfn: dict[str, list[dict]] = {}
for c in canonical_raw:
    key = surname_first_forename(c["full_name"])
    canonical_by_sfn.setdefault(key, []).append(c)

# ── matching ─────────────────────────────────────────────────────────────────

matched: list[tuple[str, str, str]] = []  # (stub_id, canonical_id, reason)
unmatched: list[dict] = []

for stub in stubs:
    sname = stub["full_name"]
    sid = stub["id"]

    # Pass 1: exact match after normalising the stub
    norm = normalise(sname).strip().lower()
    hits = canonical_by_norm.get(norm, [])
    # filter to same chamber
    hits = [h for h in hits if h["chamber"] == stub["chamber"]] or hits
    if len(hits) == 1:
        matched.append((sid, hits[0]["id"], f"title-norm → {hits[0]['full_name']}"))
        continue

    # Pass 2: surname+forename key (handles parentheticals, Mc spacing)
    skey = surname_key(normalise(sname))
    hits2 = canonical_by_surname.get(skey, [])
    hits2 = [h for h in hits2 if h["chamber"] == stub["chamber"]] or hits2
    if len(hits2) == 1:
        matched.append((sid, hits2[0]["id"], f"surname-key → {hits2[0]['full_name']}"))
        continue

    # Pass 3: surname + first-forename only (handles extra middle names)
    sfn = surname_first_forename(normalise(sname))
    hits3 = canonical_by_sfn.get(sfn, [])
    hits3 = [h for h in hits3 if h["chamber"] == stub["chamber"]] or hits3
    if len(hits3) == 1:
        matched.append((sid, hits3[0]["id"], f"sfn-key → {hits3[0]['full_name']}"))
        continue

    # Pass 4: fuzzy on sfn — ONLY within stubs sharing the same surname
    # (prevents cross-surname false positives like Adams→Adams different person)
    stub_surname = sfn.split()[0] if sfn else ""
    best_score, best_cand = 0.0, None
    for c in canonical_raw:
        if c["chamber"] != stub["chamber"]:
            continue
        c_sfn = surname_first_forename(c["full_name"])
        c_surname = c_sfn.split()[0] if c_sfn else ""
        if c_surname != stub_surname:
            continue  # must share same surname
        score = SequenceMatcher(None, sfn, c_sfn).ratio()
        if score > best_score:
            best_score, best_cand = score, c
    if best_cand and best_score >= 0.88:
        matched.append((sid, best_cand["id"], f"fuzzy({best_score:.2f}) → {best_cand['full_name']}"))
        continue

    unmatched.append(stub)

print(f"\n  Matched: {len(matched)}")
print(f"  Unmatched: {len(unmatched)}")

# ── preview ──────────────────────────────────────────────────────────────────

print("\n── Matches (first 30) ──")
for stub_id, canon_id, reason in matched[:30]:
    stub_name = next(s["full_name"] for s in stubs if s["id"] == stub_id)
    print(f"  {stub_name!r:50s} → {reason}")

print("\n── Unmatched stubs ──")
for s in unmatched:
    disc_count = sum(1 for r in disc_mp_ids_raw if r["mp_id"] == s["id"])
    print(f"  {s['full_name']!r}  ({disc_count} disclosures)")

# ── apply ────────────────────────────────────────────────────────────────────

if "--apply" not in sys.argv:
    print("\nDry run. Pass --apply to commit changes.")
    sys.exit(0)

print("\nApplying…")
rerouted = 0
deleted = 0
skipped = 0

for stub_id, canon_id, reason in matched:
    # Skip if stub and canonical are the same
    if stub_id == canon_id:
        skipped += 1
        continue
    # Re-point disclosures
    res = (
        sb.table("financial_disclosures")
        .update({"mp_id": canon_id})
        .eq("mp_id", stub_id)
        .execute()
    )
    rerouted += 1

    # Delete stub (safe — no more disclosures point to it)
    sb.table("mps").delete().eq("id", stub_id).execute()
    deleted += 1
    stub_name = next(s["full_name"] for s in stubs if s["id"] == stub_id)
    print(f"  ✓ {stub_name!r} → {reason}")

print(f"\nDone. Rerouted {rerouted} stubs, deleted {deleted} stub rows, skipped {skipped}.")
