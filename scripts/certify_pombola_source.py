#!/usr/bin/env python3
"""
Compute the SHA-256 of pa.org.za's Pombola JSON and print the
sources.lock.yaml entry ready to paste in.

Run once before first ingest:
    python scripts/certify_pombola_source.py
"""

import hashlib
import sys
import urllib.request

URL = "https://pa.org.za/media_root/popolo_json/pombola.json"
CHUNK = 1024 * 1024  # 1 MB


def main() -> None:
    print(f"Downloading {URL} ...", file=sys.stderr)
    h = hashlib.sha256()
    total = 0
    with urllib.request.urlopen(URL, timeout=120) as resp:
        while True:
            chunk = resp.read(CHUNK)
            if not chunk:
                break
            h.update(chunk)
            total += len(chunk)
            print(f"  {total / 1_000_000:.1f} MB", end="\r", file=sys.stderr)

    digest = h.hexdigest()
    print(f"\nSHA-256: {digest}", file=sys.stderr)
    print()
    print("Add this entry to config/sources.lock.yaml:")
    print("---")
    print(f"""\
  - id: "pa_pombola"
    publisher: "Parliamentary Monitoring Group"
    title: "People's Assembly - Pombola JSON (National Legislators)"
    candidate_domain: "pa.org.za"
    url: "{URL}"
    format: "json"
    tier: "tier2_indexed_republication"
    republication_of: "parliament_na_members"
    licence_note: "CC BY-SA 4.0 — Parliamentary Monitoring Group"
    default_chamber: "na"
    verified: true
    robots_ok: true
    verified_by: "Lucky Sandleni"
    verified_at: "2026-11-27"
    first_fetch_sha256: "{digest}"
    rate_limit_rps: 0.2
    contact_email: luckynyambi@gmail.com""")


if __name__ == "__main__":
    main()
