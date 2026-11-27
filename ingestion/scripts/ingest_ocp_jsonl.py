"""
Ingest an OCP bulk JSONL.GZ file (one OCDS release per line) into the tenders table.
Usage:
  python ingestion/scripts/ingest_ocp_jsonl.py <path.jsonl.gz> [--apply]
"""

import gzip
import json
import os
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

if len(sys.argv) < 2:
    print("Usage: python ingestion/scripts/ingest_ocp_jsonl.py <path.jsonl.gz> [--apply]")
    sys.exit(1)

path = sys.argv[1]
apply = "--apply" in sys.argv

# Load existing OCIDs to skip duplicates
print("Loading existing OCIDs…")
existing_ocids: set[str] = set()
offset = 0
while True:
    batch = sb.table("tenders").select("ocid").range(offset, offset + 999).execute().data or []
    existing_ocids.update(r["ocid"] for r in batch)
    if len(batch) < 1000:
        break
    offset += 1000
print(f"  {len(existing_ocids)} already in DB")

rows: list[dict] = []
skipped_no_award = 0
skipped_no_supplier = 0
skipped_duplicate = 0

print(f"Parsing {path}…")
with gzip.open(path, "rt", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue

        ocid = r.get("ocid", "")
        if not ocid:
            continue
        if ocid in existing_ocids:
            skipped_duplicate += 1
            continue

        awards = r.get("awards") or []
        if not awards:
            skipped_no_award += 1
            continue

        award = awards[0]
        suppliers = award.get("suppliers") or []
        if not suppliers:
            skipped_no_supplier += 1
            continue

        winning_company = suppliers[0].get("name", "").strip()
        if not winning_company:
            skipped_no_supplier += 1
            continue

        tender_obj = r.get("tender") or {}
        title = tender_obj.get("title") or award.get("title") or "Unknown"

        # Award value
        amount = None
        val = award.get("value") or tender_obj.get("value") or {}
        raw_amount = val.get("amount")
        if raw_amount is not None:
            try:
                amount = Decimal(str(raw_amount))
            except InvalidOperation:
                pass

        # Award date
        award_date = None
        date_str = award.get("date") or r.get("date")
        if date_str:
            try:
                award_date = datetime.fromisoformat(date_str.replace("Z", "+00:00")).date().isoformat()
            except (ValueError, AttributeError):
                pass

        department = (r.get("buyer") or {}).get("name")

        rows.append({
            "ocid": ocid,
            "title": title[:500],
            "department": department,
            "winning_company": winning_company[:300],
            "amount_zar": float(amount) if amount is not None else None,
            "award_date": award_date,
        })
        existing_ocids.add(ocid)

print(f"\nParsed {len(rows)} new tenders to insert")
print(f"  Skipped duplicates: {skipped_duplicate}")
print(f"  Skipped (no award): {skipped_no_award}")
print(f"  Skipped (no supplier): {skipped_no_supplier}")

if not rows:
    print("Nothing to insert.")
    sys.exit(0)

# Preview
print("\n── Sample ──")
for r in rows[:5]:
    print(f"  {r['winning_company']!r:40s}  {r['department']!r:40s}  {r['award_date']}  R{r['amount_zar'] or '?'}")

if not apply:
    print("\nDry run. Pass --apply to write.")
    sys.exit(0)

# Insert in batches
print("\nInserting…")
CHUNK = 500
inserted = 0
for i in range(0, len(rows), CHUNK):
    chunk = rows[i: i + CHUNK]
    result = sb.table("tenders").upsert(chunk, on_conflict="ocid", ignore_duplicates=True).execute()
    inserted += len(result.data or [])
    print(f"  {i + len(chunk)}/{len(rows)}")

print(f"\nDone. {inserted} rows inserted.")
