import re
from bs4 import BeautifulSoup
from ..errors import ParserSpecGap
from ..models import ParsedDocument, MPSeed
from .base import PARSER_VERSION_PREFIX, BaseParser


class PmgNaMembersParser(BaseParser):
    source_id = "pmg_na_members"

    @property
    def parser_version(self) -> str:
        return f"{PARSER_VERSION_PREFIX}+{self.source_id}"

    def parse(self, *, content: bytes, content_type: str, fetched_url: str) -> ParsedDocument:
        if "html" not in content_type.lower():
            raise ParserSpecGap(f"format not verified: {content_type!r}")

        soup = BeautifulSoup(content, "html.parser")
        mps = []

        for text_node in soup.stripped_strings:
            # Matches: "Abader, Ms ZS MKP" or "Abrahams, Mr B"
            match = re.match(r"^([A-Za-z\-\s]+),\s+(Mr|Ms|Mrs|Dr|Adv|Prof|Rev|Inkosi|Prince|Chief)\s+([A-Z\s]+)\s+([A-Z\s]+)$", text_node)
            if match:
                surname = match.group(1).strip()
                title = match.group(2)
                initials = match.group(3).strip()
                full_name = f"{surname}, {title} {initials}"
                mps.append(MPSeed(full_name=full_name, chamber="na"))

        if not mps:
            raise ParserSpecGap("Zero MPs parsed from PMG NA list.")

        return ParsedDocument(source_id=self.source_id, mps=mps)
