"""Parser for ElectAI ward councillor candidate data.

Source: electai.co.za/api/ward/{ward_id}
Format: JSON API (one endpoint per ward, 4,485 wards total)
Cadence: updated when IEC releases new certified candidate lists.

The main page HTML is used as the gated source document (SHA gate).
Within parse(), all 4,485 ward APIs are fetched asynchronously.

Ward IDs are IEC 8-digit codes: {5-digit muni prefix}{3-digit ward number}.
213 municipalities; wards numbered from 001 upward, stopping at first 404.

Emits:
  - MPSeed(chamber='local') for each 2026 ward candidate (most likely winner
    is the sitting councillor once results are certified).
  - MunicipalitySeed for each municipality encountered.
"""

import asyncio
import json
import logging
from datetime import date, datetime

import httpx

from ..errors import ParserSpecGap
from ..models import MPSeed, MunicipalitySeed, ParsedDocument
from .base import PARSER_VERSION_PREFIX, BaseParser

log = logging.getLogger("publikeye.ingestion")

API_VERSION = "1.48.0"
BASE_URL = "https://www.electai.co.za"
CONCURRENCY = 30   # max simultaneous in-flight requests
REQUEST_TIMEOUT = 20
_WARD_RETRIES = 3

# 213 municipality prefixes → IEC demarcation code, extracted from ElectAI layout bundle.
# robots.txt: ai-input=yes
MUNI_PREFIXES: dict[str, str] = {
    "10101": "WC011", "10102": "WC012", "10103": "WC013", "10104": "WC014",
    "10105": "WC015", "10202": "WC022", "10203": "WC023", "10204": "WC024",
    "10205": "WC025", "10206": "WC026", "10301": "WC031", "10302": "WC032",
    "10303": "WC033", "10304": "WC034", "10401": "WC041", "10402": "WC042",
    "10403": "WC043", "10404": "WC044", "10405": "WC045", "10407": "WC047",
    "10408": "WC048", "10501": "WC051", "10502": "WC052", "10503": "WC053",
    "19100": "CPT",   "21001": "EC101", "21002": "EC102", "21004": "EC104",
    "21005": "EC105", "21006": "EC106", "21008": "EC108", "21009": "EC109",
    "21201": "EC121", "21202": "EC122", "21203": "EC123", "21204": "EC124",
    "21206": "EC126", "21209": "EC129", "21301": "EC131", "21305": "EC135",
    "21306": "EC136", "21307": "EC137", "21308": "EC138", "21309": "EC139",
    "21401": "EC141", "21402": "EC142", "21405": "EC145", "21503": "EC153",
    "21504": "EC154", "21505": "EC155", "21506": "EC156", "21507": "EC157",
    "24401": "EC441", "24402": "EC442", "24403": "EC443", "24404": "EC444",
    "29200": "BUF",   "29300": "NMA",   "30601": "NC061", "30602": "NC062",
    "30604": "NC064", "30605": "NC065", "30606": "NC066", "30607": "NC067",
    "30701": "NC071", "30702": "NC072", "30703": "NC073", "30704": "NC074",
    "30705": "NC075", "30706": "NC076", "30707": "NC077", "30708": "NC078",
    "30802": "NC082", "30804": "NC084", "30805": "NC085", "30806": "NC086",
    "30807": "NC087", "30901": "NC091", "30902": "NC092", "30903": "NC093",
    "30904": "NC094", "34501": "NC451", "34502": "NC452", "34503": "NC453",
    "41601": "FS161", "41602": "FS162", "41603": "FS163", "41801": "FS181",
    "41802": "FS182", "41803": "FS183", "41804": "FS184", "41805": "FS185",
    "41901": "FS191", "41902": "FS192", "41903": "FS193", "41904": "FS194",
    "41905": "FS195", "41906": "FS196", "42001": "FS201", "42003": "FS203",
    "42004": "FS204", "42005": "FS205", "49400": "MAN",   "52102": "KZN212",
    "52103": "KZN213", "52104": "KZN214", "52106": "KZN216", "52201": "KZN221",
    "52202": "KZN222", "52203": "KZN223", "52204": "KZN224", "52205": "KZN225",
    "52206": "KZN226", "52207": "KZN227", "52305": "KZN235", "52307": "KZN237",
    "52308": "KZN238", "52401": "KZN241", "52402": "KZN242", "52404": "KZN244",
    "52405": "KZN245", "52502": "KZN252", "52503": "KZN253", "52504": "KZN254",
    "52601": "KZN261", "52602": "KZN262", "52603": "KZN263", "52605": "KZN265",
    "52606": "KZN266", "52701": "KZN271", "52702": "KZN272", "52705": "KZN275",
    "52706": "KZN276", "52801": "KZN281", "52802": "KZN282", "52804": "KZN284",
    "52805": "KZN285", "52806": "KZN286", "52901": "KZN291", "52902": "KZN292",
    "52903": "KZN293", "52904": "KZN294", "54303": "KZN433", "54304": "KZN434",
    "54305": "KZN435", "54306": "KZN436", "59500": "ETH",   "63701": "NW371",
    "63702": "NW372", "63703": "NW373", "63704": "NW374", "63705": "NW375",
    "63801": "NW381", "63802": "NW382", "63803": "NW383", "63804": "NW384",
    "63805": "NW385", "63902": "NW392", "63903": "NW393", "63904": "NW394",
    "63906": "NW396", "63907": "NW397", "64003": "NW403", "64004": "NW404",
    "64005": "NW405", "74201": "GT421", "74202": "GT422", "74203": "GT423",
    "74801": "GT481", "74804": "GT484", "74805": "GT485", "79700": "EKU",
    "79800": "JHB",   "79900": "TSH",   "83001": "MP301", "83002": "MP302",
    "83003": "MP303", "83004": "MP304", "83005": "MP305", "83006": "MP306",
    "83007": "MP307", "83101": "MP311", "83102": "MP312", "83103": "MP313",
    "83104": "MP314", "83105": "MP315", "83106": "MP316", "83201": "MP321",
    "83204": "MP324", "83205": "MP325", "83206": "MP326", "93301": "LIM331",
    "93302": "LIM332", "93303": "LIM333", "93304": "LIM334", "93305": "LIM335",
    "93401": "LIM341", "93403": "LIM343", "93404": "LIM344", "93405": "LIM345",
    "93501": "LIM351", "93503": "LIM353", "93504": "LIM354", "93505": "LIM355",
    "93601": "LIM361", "93602": "LIM362", "93606": "LIM366", "93607": "LIM367",
    "93608": "LIM368", "94701": "LIM471", "94702": "LIM472", "94703": "LIM473",
    "94706": "LIM476",
}

PROVINCE_BY_PREFIX: dict[str, str] = {
    "10": "Western Cape", "19": "Western Cape",
    "21": "Eastern Cape",  "24": "Eastern Cape",
    "29": "Eastern Cape",
    "30": "Northern Cape", "34": "Northern Cape",
    "41": "Free State",    "42": "Free State",    "49": "Free State",
    "52": "KwaZulu-Natal", "54": "KwaZulu-Natal", "59": "KwaZulu-Natal",
    "63": "North West",    "64": "North West",
    "74": "Gauteng",       "79": "Gauteng",
    "83": "Mpumalanga",
    "93": "Limpopo",       "94": "Limpopo",
}


def _province(prefix: str) -> str | None:
    return PROVINCE_BY_PREFIX.get(prefix[:2])


async def _fetch_ward(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    ward_id: str,
) -> dict | None:
    """Fetch a single ward, retrying on transient failures. Returns None on 404 or exhausted retries."""
    url = f"{BASE_URL}/api/ward/{ward_id}?v={API_VERSION}"
    async with sem:
        for attempt in range(_WARD_RETRIES):
            try:
                r = await client.get(url, timeout=REQUEST_TIMEOUT)
                if r.status_code == 404:
                    return None
                if r.status_code == 429 or r.status_code >= 500:
                    if attempt < _WARD_RETRIES - 1:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    log.warning("ward %s: HTTP %s after %d attempts", ward_id, r.status_code, _WARD_RETRIES)
                    return None
                r.raise_for_status()
                return r.json()
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                if attempt < _WARD_RETRIES - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
                log.warning("ward %s: network error after %d attempts: %s", ward_id, _WARD_RETRIES, exc)
                return None
            except Exception as exc:
                log.debug("ward %s: unexpected error: %s", ward_id, exc)
                return None
    return None


async def _fetch_muni(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    prefix: str,
    dem_code: str,
) -> tuple[str, str, list[tuple[str, dict]]]:
    """Probe all wards for one municipality; stop after 3 consecutive misses."""
    ward_no = 1
    consecutive_misses = 0
    results: list[tuple[str, dict]] = []

    while ward_no <= 200 and consecutive_misses < 3:
        ward_id = f"{prefix}{ward_no:03d}"
        data = await _fetch_ward(client, sem, ward_id)
        if data is None:
            consecutive_misses += 1
        else:
            consecutive_misses = 0
            results.append((ward_id, data))
        ward_no += 1

    log.info("muni %s (%s): %d wards found", dem_code, prefix, len(results))
    return prefix, dem_code, results


async def _fetch_all() -> tuple[list[MPSeed], list[MunicipalitySeed]]:
    """Fetch all wards across all municipalities CONCURRENTLY."""
    sem = asyncio.Semaphore(CONCURRENCY)
    headers = {
        "User-Agent": "PublikEye/1.0 (transparency research; ai-input=yes per robots.txt)",
        "Accept": "application/json",
    }

    mps: list[MPSeed] = []
    munis_seen: dict[str, MunicipalitySeed] = {}

    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        # Run all 213 municipalities concurrently — semaphore caps in-flight requests
        tasks = [
            _fetch_muni(client, sem, prefix, dem_code)
            for prefix, dem_code in MUNI_PREFIXES.items()
        ]
        all_results = await asyncio.gather(*tasks, return_exceptions=True)

    for item in all_results:
        if isinstance(item, Exception):
            log.warning("municipality fetch raised: %s", item)
            continue

        prefix, dem_code, ward_results = item

        for ward_id, data in ward_results:
            muni_data = data.get("municipality") or {}
            muni_code = muni_data.get("code") or dem_code
            muni_name = muni_data.get("name") or ""
            province = muni_data.get("province") or _province(prefix) or ""
            ward_no_str = str((data.get("ward") or {}).get("no", ""))

            if muni_code and muni_code not in munis_seen:
                munis_seen[muni_code] = MunicipalitySeed(
                    demarcation_code=muni_code,
                    name=muni_name or muni_code,
                    province=province or None,
                )

            constituency = f"{muni_name} Ward {ward_no_str}" if ward_no_str else muni_name

            # 2026 ward candidates
            for cand in data.get("candidates") or []:
                name = (cand.get("name") or "").strip()
                party = (cand.get("partyName") or cand.get("party") or "").strip() or None
                if not name or len(name) < 2:
                    continue
                mps.append(MPSeed(
                    full_name=name,
                    chamber="local",
                    government_level="local",
                    party=party,
                    constituency=constituency,
                ))

            # 2021 election winner (sitting councillor until results certified)
            history = data.get("history") or {}
            predecessors = history.get("predecessors") or []
            if predecessors:
                winner = predecessors[0]
                w_name = (winner.get("name") or "").strip()
                w_party = (winner.get("party") or "").strip() or None
                if w_name and len(w_name) >= 2:
                    mps.append(MPSeed(
                        full_name=w_name,
                        chamber="local",
                        government_level="local",
                        party=w_party,
                        constituency=constituency,
                        portfolio="Sitting Councillor (2021)",
                    ))

    return mps, list(munis_seen.values())


class ElectAIWardsParser(BaseParser):
    source_id = "electai_wards"

    @property
    def parser_version(self) -> str:
        return f"{PARSER_VERSION_PREFIX}+{self.source_id}"

    def parse(self, *, content: bytes, content_type: str, fetched_url: str) -> ParsedDocument:
        # content = HTML of /councillors-in-my-ward (used only for SHA gate)
        # Verify it looks like the right page
        if b"ward" not in content.lower() and b"electai" not in content.lower():
            raise ParserSpecGap("ElectAI councillors page content not recognised.")

        try:
            mps, munis = asyncio.run(_fetch_all())
        except Exception as exc:
            raise ParserSpecGap(f"ElectAI ward fetch failed: {exc}") from exc

        if not mps:
            raise ParserSpecGap("Zero ward candidates returned from ElectAI API.")

        log.info("electai_wards: %d candidates, %d municipalities", len(mps), len(munis))
        return ParsedDocument(
            source_id=self.source_id,
            published_at=date.today(),
            mps=mps,
            municipalities=munis,
        )
