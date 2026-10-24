import re
from bs4 import BeautifulSoup
from ..errors import ParserSpecGap
from ..models import ParsedDocument, MPSeed
from .base import PARSER_VERSION_PREFIX, BaseParser


class NationalGovNcopMembersParser(BaseParser):
    source_id = "nationalgov_ncop_members"

    @property
    def parser_version(self) -> str:
        return f"{PARSER_VERSION_PREFIX}+{self.source_id}"

    def parse(self, *, content: bytes, content_type: str, fetched_url: str) -> ParsedDocument:
        if "html" not in content_type.lower():
            raise ParserSpecGap(f"format not verified: {content_type!r}")

        soup = BeautifulSoup(content, "html.parser")
        mps = []

        for text_node in soup.stripped_strings:
            for line in text_node.split('\n'):
                line = line.strip()
                if line.startswith("- "):
                    clean_text = line[2:].strip()
                    name_match = re.match(r"^((?:Mr|Ms|Mrs|Dr|Adv|Prof|Rev|Inkosi|Prince|Chief)\s+[^\(]+)", clean_text)
                    if name_match:
                        full_name = name_match.group(1).strip()
                        mps.append(MPSeed(full_name=full_name, chamber="ncop"))

        if not mps:
            raise ParserSpecGap("Zero MPs parsed from National Government NCOP list.")

        return ParsedDocument(source_id=self.source_id, mps=mps)
