"""Parser for the People's Assembly Pombola JSON.

Source: pa.org.za/media_root/popolo_json/pombola.json
Format: Pombola — persons array, with memberships nested inside each person.
Cadence: regenerated daily by PMG.

Emits current NA (core_organisation:70) and NCOP (core_organisation:71)
members only. Party is resolved from the person's current Party-classified
membership with no end_date.
"""

import json
from datetime import date

from ..errors import ParserSpecGap
from ..models import MPSeed, ParsedDocument
from .base import PARSER_VERSION_PREFIX, BaseParser

NA_ORG_ID   = "core_organisation:70"
NCOP_ORG_ID = "core_organisation:71"

CHAMBER_BY_ORG = {
    NA_ORG_ID:   "na",
    NCOP_ORG_ID: "ncop",
}


def _parse_date(val: str | None) -> date | None:
    if not val:
        return None
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
    if not end_raw:
        return True
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

        # Index organizations by id
        orgs: dict[str, dict] = {o["id"]: o for o in data.get("organizations", [])}

        mps: list[MPSeed] = []
        seen: set[tuple[str, str]] = set()

        for person in data.get("persons", []):
            memberships = person.get("memberships", [])
            full_name = (person.get("name") or "").strip()
            if not full_name:
                continue

            # Find current legislative memberships (NA or NCOP)
            leg_memberships: list[tuple[str, str | None, str | None]] = []
            for mem in memberships:
                oid = mem.get("organization_id", "")
                chamber = CHAMBER_BY_ORG.get(oid)
                if chamber and _is_current(mem.get("end_date")):
                    leg_memberships.append((
                        chamber,
                        mem.get("start_date"),
                        mem.get("end_date"),
                    ))

            if not leg_memberships:
                continue

            # Resolve current party: Party-classified membership with no end_date
            party: str | None = None
            for mem in memberships:
                oid = mem.get("organization_id", "")
                org = orgs.get(oid, {})
                if org.get("classification") == "Party" and _is_current(mem.get("end_date")):
                    party = (org.get("name") or "").strip() or None
                    # Prefer the most recent party (last one wins if multiple current)

            # Emit one MPSeed per chamber (deduplicated)
            chambers_seen: set[str] = set()
            for chamber, start_raw, end_raw in leg_memberships:
                if chamber in chambers_seen:
                    continue
                chambers_seen.add(chamber)

                key = (full_name.lower(), chamber)
                if key in seen:
                    continue
                seen.add(key)

                mps.append(MPSeed(
                    full_name=full_name,
                    chamber=chamber,
                    party=party,
                    term_start=_parse_date(start_raw),
                    term_end=_parse_date(end_raw),
                    government_level="national",
                ))

        if not mps:
            raise ParserSpecGap("Zero current national members parsed from Pombola JSON.")

        return ParsedDocument(source_id=self.source_id, mps=mps)
