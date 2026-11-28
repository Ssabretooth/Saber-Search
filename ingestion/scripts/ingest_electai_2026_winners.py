"""
Ingest 2026 LGE ward councillors from ElectAI results API.

Endpoint: https://www.electai.co.za/api/results/{muni_code}
Returns all candidates per ward; row 0 = highest votes = ward winner.

Usage:
    python ingestion/scripts/ingest_electai_2026_winners.py [--apply]

Dry run by default; pass --apply to write to Supabase.
"""

import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from typing import NamedTuple

import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

BASE_URL = "https://www.electai.co.za"
API_VERSION = "1.48.0"
CONCURRENCY = 8
TIMEOUT = 20

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

# 213 IEC demarcation codes (from electai_wards.py MUNI_PREFIXES values)
MUNI_CODES = [
    "WC011","WC012","WC013","WC014","WC015","WC022","WC023","WC024","WC025","WC026",
    "WC031","WC032","WC033","WC034","WC041","WC042","WC043","WC044","WC045","WC047",
    "WC048","WC051","WC052","WC053","CPT",
    "EC101","EC102","EC104","EC105","EC106","EC108","EC109",
    "EC121","EC122","EC123","EC124","EC126","EC129","EC131","EC135","EC136","EC137",
    "EC138","EC139","EC141","EC142","EC145","EC153","EC154","EC155","EC156","EC157",
    "EC441","EC442","EC443","EC444","BUF","NMA",
    "NC061","NC062","NC064","NC065","NC066","NC067","NC071","NC072","NC073","NC074",
    "NC075","NC076","NC077","NC078","NC082","NC084","NC085","NC086","NC087",
    "NC091","NC092","NC093","NC094","NC451","NC452","NC453",
    "FS161","FS162","FS163","FS181","FS182","FS183","FS184","FS185",
    "FS191","FS192","FS193","FS194","FS195","FS196","FS201","FS203","FS204","FS205","MAN",
    "KZN212","KZN213","KZN214","KZN216","KZN221","KZN222","KZN223","KZN224","KZN225",
    "KZN226","KZN227","KZN235","KZN237","KZN238","KZN241","KZN242","KZN244","KZN245",
    "KZN252","KZN253","KZN254","KZN261","KZN262","KZN263","KZN265","KZN266",
    "KZN271","KZN272","KZN275","KZN276","KZN281","KZN282","KZN284","KZN285","KZN286",
    "KZN291","KZN292","KZN293","KZN294","KZN433","KZN434","KZN435","KZN436","ETH",
    "NW371","NW372","NW373","NW374","NW375","NW381","NW382","NW383","NW384","NW385",
    "NW392","NW393","NW394","NW396","NW397","NW403","NW404","NW405",
    "GT421","GT422","GT423","GT481","GT484","GT485","EKU","JHB","TSH",
    "MP301","MP302","MP303","MP304","MP305","MP306","MP307",
    "MP311","MP312","MP313","MP314","MP315","MP316","MP321","MP324","MP325","MP326",
    "LIM331","LIM332","LIM333","LIM334","LIM335","LIM341","LIM343","LIM344","LIM345",
    "LIM351","LIM353","LIM354","LIM355","LIM361","LIM362","LIM366","LIM367","LIM368",
    "LIM471","LIM472","LIM473","LIM476",
]

PARTY_DISPLAY = {
    "AFRICAN NATIONAL CONGRESS": "African National Congress",
    "DEMOCRATIC ALLIANCE": "Democratic Alliance",
    "ECONOMIC FREEDOM FIGHTERS": "Economic Freedom Fighters",
    "UMKHONTO WESIZWE PARTY": "uMkhonto weSizwe Party",
    "INKATHA FREEDOM PARTY": "Inkatha Freedom Party",
    "ACTIONSA": "ActionSA",
    "PATRIOTIC ALLIANCE": "Patriotic Alliance",
    "AL JAMA-AH": "Al Jama-ah",
    "UNITED DEMOCRATIC MOVEMENT": "United Democratic Movement",
    "AFRICAN CHRISTIAN DEMOCRATIC PARTY": "African Christian Democratic Party",
    "FREEDOM FRONT PLUS": "Freedom Front Plus",
    "SOUTH AFRICAN COMMUNIST PARTY": "South African Communist Party",
    "INDEPENDENT": "Independent",
}


class WardWinner(NamedTuple):
    muni_code: str
    ward_id: str
    ward_no: int
    name: str
    party: str
    votes: int


async def fetch_muni_results(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    muni_code: str,
) -> list[WardWinner]:
    url = f"{BASE_URL}/api/results/{muni_code}"
    headers = {
        "User-Agent": "PublikEye/1.0 (transparency research; ai-input=yes per robots.txt)",
        "Accept": "application/json",
    }
    async with sem:
        try:
            r = await client.get(url, timeout=TIMEOUT, headers=headers)
            if r.status_code == 404:
                log.warning("No results for %s", muni_code)
                return []
            r.raise_for_status()
            data = r.json()
        except Exception as exc:
            log.warning("Failed to fetch %s: %s", muni_code, exc)
            return []

    wards = data.get("wards") or {}
    muni_name = data.get("name", muni_code)
    winners = []
    for ward_id, ward in wards.items():
        rows = ward.get("rows") or []
        if not rows:
            continue
        top = rows[0]
        name = (top.get("candidate") or "").strip()
        party_raw = (top.get("party") or "").strip()
        party = PARTY_DISPLAY.get(party_raw, party_raw.title())
        votes = top.get("votes") or 0
        ward_no = ward.get("wardNo") or 0
        if name and len(name) >= 3:
            winners.append(WardWinner(
                muni_code=muni_code,
                ward_id=ward_id,
                ward_no=ward_no,
                name=name,
                party=party,
                votes=votes,
            ))
    log.info("%-12s %-40s  %d ward winners", muni_code, muni_name[:40], len(winners))
    return winners


async def fetch_all() -> list[WardWinner]:
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(follow_redirects=True) as client:
        tasks = [fetch_muni_results(client, sem, code) for code in MUNI_CODES]
        results = await asyncio.gather(*tasks)
    flat = [w for batch in results for w in batch]
    return flat


def upsert_winners(winners: list[WardWinner]) -> None:
    import httpx as _httpx

    # Load ward-picker to get muni names and slugs
    r = _httpx.get(
        f"{BASE_URL}/ward-picker.json?v={API_VERSION}",
        headers={"User-Agent": "PublikEye/1.0 (transparency research; ai-input=yes per robots.txt)"},
        timeout=15,
    )
    r.raise_for_status()
    ward_picker = r.json()
    muni_name_by_code: dict[str, str] = {}
    for m in ward_picker:
        # slug like "city-of-johannesburg-jhb" → code extracted from ward IDs
        for w in m.get("wards") or []:
            prefix = str(w["id"])[:5]
            # match to MUNI_PREFIXES in reverse
            pass
        muni_name_by_code[m["slug"]] = m["name"]

    # Build muni code → name from MUNI_PREFIXES
    # We'll resolve muni name from results data we already have
    # Instead: use muni_code directly in constituency
    sb_headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    # Load existing local councillors to avoid duplicates
    existing = set()
    offset = 0
    PAGE = 1000
    while True:
        resp = _httpx.get(
            f"{SUPABASE_URL}/rest/v1/mps",
            params={
                "select": "full_name,constituency",
                "chamber": "eq.local",
                "term_start": "eq.2026-11-04",
                "offset": offset,
                "limit": PAGE,
            },
            headers=sb_headers,
            timeout=30,
        )
        rows = resp.json() if resp.status_code == 200 else []
        for row in rows:
            existing.add((row["full_name"], row["constituency"]))
        if len(rows) < PAGE:
            break
        offset += PAGE
    log.info("Existing 2026 ward councillors in DB: %d", len(existing))

    to_insert = []
    for w in winners:
        constituency = f"{w.muni_code} Ward {w.ward_no}"
        key = (w.name, constituency)
        if key in existing:
            continue
        to_insert.append({
            "full_name": w.name,
            "chamber": "local",
            "government_level": "local",
            "party": w.party,
            "constituency": constituency,
            "portfolio": "Ward Councillor (2026)",
            "term_start": "2026-11-04",  # LGE election day
        })

    if not to_insert:
        log.info("Nothing new to insert.")
        return

    # Deduplicate within batch on DB natural key (full_name, chamber, term_start)
    seen_keys: set[tuple] = set()
    deduped = []
    for row in to_insert:
        key = (row["full_name"], row["chamber"], row.get("term_start"))
        if key not in seen_keys:
            seen_keys.add(key)
            deduped.append(row)
    if len(deduped) < len(to_insert):
        log.info("Deduplicated %d → %d rows (same name, chamber, term_start)", len(to_insert), len(deduped))
    to_insert = deduped

    log.info("Inserting %d new ward councillors…", len(to_insert))
    CHUNK = 500
    inserted = 0
    for i in range(0, len(to_insert), CHUNK):
        chunk = to_insert[i:i + CHUNK]
        resp = _httpx.post(
            f"{SUPABASE_URL}/rest/v1/mps",
            headers={**sb_headers, "Prefer": "return=minimal,resolution=ignore-duplicates"},
            json=chunk,
            timeout=60,
        )
        if resp.status_code not in (200, 201):
            log.error("Insert failed (%d): %s", resp.status_code, resp.text[:200])
        else:
            inserted += len(chunk)
            log.info("  %d/%d inserted", inserted, len(to_insert))

    log.info("Done. %d ward councillors inserted.", inserted)


def main() -> None:
    apply = "--apply" in sys.argv

    log.info("Fetching 2026 ward results from ElectAI (%d municipalities)…", len(MUNI_CODES))
    winners = asyncio.run(fetch_all())
    log.info("Total ward winners found: %d", len(winners))

    # Summary
    party_counts: dict[str, int] = {}
    for w in winners:
        party_counts[w.party] = party_counts.get(w.party, 0) + 1
    log.info("\n── Party breakdown ──")
    for party, count in sorted(party_counts.items(), key=lambda x: -x[1])[:15]:
        log.info("  %-45s %d", party, count)

    if not apply:
        log.info("\nDry run complete. Pass --apply to write to DB.")
        return

    upsert_winners(winners)


if __name__ == "__main__":
    main()
