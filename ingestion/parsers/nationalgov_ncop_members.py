import re
from bs4 import BeautifulSoup
from ..errors import ParserSpecGap
from ..models import ParsedDocument, MPSeed
from .base import PARSER_VERSION_PREFIX, BaseParser

# Titles that begin an NCOP delegate name
_TITLE_RE = re.compile(
    r"\b(Mr|Ms|Mrs|Dr|Adv|Prof|Rev|Inkosi|Chief|Prince|Princess)\s+",
)

# Split the continuous names blob on title boundaries while keeping the title
_SPLIT_RE = re.compile(
    r"(?=\b(?:Mr|Ms|Mrs|Dr|Adv|Prof|Rev|Inkosi|Chief|Prince|Princess)\s+[A-Z])"
)

# Party abbreviation suffix — strip it from the name
_PARTY_SUFFIX_RE = re.compile(r"\s*\([^)]*\)\s*$")

# Committee / role noise appended in parentheses before the party
_ROLE_RE = re.compile(r"\s*\((?:Chairperson|Co-Chairperson|House Chairperson|Chief Whip|Programming Whip|Representative)[^)]*\)\s*")


def _extract_names_from_blob(blob: str) -> list[str]:
    """Split a run-on names string into individual cleaned names."""
    # Remove section labels so they don't contaminate names
    blob = re.sub(r"\b(?:Deputy Chairperson|Chairperson|Members|Secretary|Undersecretary)\s*:", " ", blob)
    # Remove all parenthetical content (roles, parties, alternates)
    blob = re.sub(r"\([^)]*\)", " ", blob)
    # Collapse whitespace
    blob = re.sub(r"\s+", " ", blob).strip()

    parts = _SPLIT_RE.split(blob)
    names: list[str] = []
    for part in parts:
        part = part.strip().strip("(),;:")
        if not _TITLE_RE.match(part):
            continue
        part = re.sub(r"\s+", " ", part).strip()
        if len(part) > 5:
            names.append(part)
    return names


class NationalGovNcopMembersParser(BaseParser):
    source_id = "nationalgov_ncop_members"

    @property
    def parser_version(self) -> str:
        return f"{PARSER_VERSION_PREFIX}+{self.source_id}.v2"

    def parse(self, *, content: bytes, content_type: str, fetched_url: str) -> ParsedDocument:
        if "html" not in content_type.lower():
            raise ParserSpecGap(f"format not verified: {content_type!r}")

        soup = BeautifulSoup(content, "html.parser")
        full_text = soup.get_text(separator=" ", strip=True)

        # Isolate the full delegates section — anchored by the "54 permanent delegates" intro
        # so we capture Chairperson, Deputy Chairperson and all Members in one blob.
        section_anchor = "permanent delegates to the NCOP"
        idx = full_text.find(section_anchor)
        if idx == -1:
            # Fallback: find just the Members: block
            idx = full_text.find("Members:")
            if idx == -1:
                raise ParserSpecGap("Could not locate delegates section in NCOP page.")
            preamble_start = idx
        else:
            # Start right after the anchor sentence (ends with "NCOP.")
            preamble_start = full_text.find(".", idx) + 1

        end_marker = "Secretary to the National Council"
        end_idx = full_text.find(end_marker, preamble_start)
        blob = full_text[preamble_start: end_idx if end_idx != -1 else preamble_start + 8000]

        names = _extract_names_from_blob(blob)
        if not names:
            raise ParserSpecGap("Zero NCOP delegates parsed.")

        mps = [MPSeed(full_name=n, chamber="ncop") for n in names]
        return ParsedDocument(source_id=self.source_id, mps=mps)
