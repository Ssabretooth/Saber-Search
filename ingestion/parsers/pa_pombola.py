"""Parser for the People's Assembly Pombola JSON.

Source: pa.org.za/media_root/popolo_json/pombola.json
Format: Popolo/Pombola — persons, memberships, organizations.
Cadence: regenerated daily by PMG; this is the same feed OpenSanctions ingests.

Only current national members are emitted (end_date null or future).
Provincial legislators are skipped — their government_level is "provincial"
but we only ingest chamber="na" and chamber="ncop" here.
"""

import json
from datetime import date

from ..errors import ParserSpecGap
from ..models import MPSeed, ParsedDocument
from .base import PARSER_VERSION_PREFIX, BaseParser

# Organization name fragments → chamber code
_CHAMBER_MAP = {
    "national assembly": "na",
    "national council of provinces": "ncop",
}


def _parse_date(val: str | None) -> date | None:
    if not val:
        return None
    # Pombola dates may be partial: "2024-06-" or "2024-06-01"
    clean = val.rstrip("-").strip()
    if not clean:
        return None
    parts = clean.split("-")
    try:
        if len(parts) == 1:
            return date(int(parts[0]), 1, 1)
        if len(parts) == 2:
            return date(int(parts[0]), int(parts[1]), 1)
        return date(int(parts[0]), int(parts[1]), int(parts[2]))
    except (ValueError, TypeError):
        return None


def _is_current(end_raw: str | None) -> bool:
    end = _parse_date(end_raw)
    return end is None or end >= date.today()


class PaPombolaParser(BaseParser):
    source_id = "pa_pombola"

    @property
    def parser_version(self) -> str:
        return f"{PARSER_VERSION_PREFIX}+{self.source_id}"

    def parse(self, *, content: bytes, content_type: str, fetched_url: str) -> ParsedDocument:
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            raise ParserSpecGap(f"invalid JSON: {e}") from e

        # --- Index organizations ---
        orgs: dict[str, dict] = {o["id"]: o for o in data.get("organizations", [])}

        # Identify national legislature orgs
        legislature_to_chamber: dict[str, str] = {}
        for oid, org in orgs.items():
            name_lower = (org.get("name") or "").lower()
            for fragment, chamber in _CHAMBER_MAP.items():
                if fragment in name_lower:
                    legislature_to_chamber[oid] = chamber
                    break

        if not legislature_to_chamber:
            raise ParserSpecGap("No National Assembly or NCOP organization found in Pombola data.")

        # --- Index persons ---
        persons: dict[str, str] = {
            p["id"]: (p.get("name") or "").strip()
            for p in data.get("persons", [])
        }

        # --- Process memberships ---
        # A person may have one legislature membership and one party membership.
        # Legislature membership: organization_id in legislature_to_chamber
        # Party membership: on_behalf_of_id OR a separate membership to a party org

        # Collect legislature memberships keyed by person_id
        leg_memberships: dict[str, list[dict]] = {}
        # Collect party name keyed by person_id (from on_behalf_of_id)
        person_party: dict[str, str] = {}

        for mem in data.get("memberships", []):
            pid = mem.get("person_id")
            oid = mem.get("organization_id")

            if not pid or not oid:
                continue

            chamber = legislature_to_chamber.get(oid)
            if chamber and _is_current(mem.get("end_date")):
                leg_memberships.setdefault(pid, []).append({
                    "chamber": chamber,
                    "start_date": _parse_date(mem.get("start_date")),
                    "end_date": _parse_date(mem.get("end_date")),
                    "role": mem.get("role"),
                    "on_behalf_of_id": mem.get("on_behalf_of_id"),
                })

            # Party from on_behalf_of_id on any membership
            behalf = mem.get("on_behalf_of_id")
            if behalf and behalf in orgs and pid not in person_party:
                person_party[pid] = (orgs[behalf].get("name") or "").strip()

        # --- Build MPSeed list ---
        mps: list[MPSeed] = []
        seen: set[tuple[str, str]] = set()

        for pid, memberships in leg_memberships.items():
            full_name = persons.get(pid, "").strip()
            if not full_name:
                continue

            party = person_party.get(pid)

            for mem in memberships:
                chamber = mem["chamber"]
                key = (full_name.lower(), chamber)
                if key in seen:
                    continue
                seen.add(key)

                mps.append(MPSeed(
                    full_name=full_name,
                    chamber=chamber,
                    party=party or None,
                    term_start=mem["start_date"],
                    term_end=mem["end_date"],
                    government_level="national",
                ))

        if not mps:
            raise ParserSpecGap("Zero current national members parsed from Pombola JSON.")

        return ParsedDocument(source_id=self.source_id, mps=mps)
