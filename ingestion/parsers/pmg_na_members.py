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
        
        # Flatten all text into a single string, replacing newlines/tabs with spaces
        text = " ".join(soup.stripped_strings)
        
        # Pattern to match: Surname, Title Initials Party
        # 1. Surname: starts with letter, allows spaces/hyphens (e.g., "de Blocq van Scheltinga", "Van den Berg")
        # 2. Separator: comma or space (some entries miss the comma)
        # 3. Title: Mr, Ms, Dr, Adv, Prof, Rev, Inkosi, Prince, Chief, Hon
        # 4. Initials: 1-10 chars of uppercase or spaces
        # 5. Party: 1-20 chars of uppercase, numbers, hyphens, spaces
        # 6. Lookahead: Ensure followed by another name pattern or end of string
        pattern = r"([A-Za-z][a-zA-Z\-\s']+?)(?:,|\s)\s*(Mr|Ms|Mrs|Dr|Adv|Prof|Rev|Inkosi|Prince|Chief|Hon)\.?\s+([A-Z\s]{1,10}?)\s+([A-Z0-9\-\s]+?)(?=\s+[A-Za-z][a-zA-Z\-\s']+(?:,|\s)\s*(?:Mr|Ms|Mrs|Dr|Adv|Prof|Rev|Inkosi|Prince|Chief|Hon)|\s*$)"

        matches = re.findall(pattern, text)
        
        mps = []
        seen = set()
        
        for match in matches:
            surname = match[0].strip()
            title = match[1].replace(".", "") # Clean up "Mr." to "Mr"
            initials = match[2].strip()
            party = match[3].strip()
            
            # Format for database
            full_name = f"{surname}, {title} {initials}"
            
            # Deduplicate
            if full_name not in seen:
                seen.add(full_name)
                mps.append(MPSeed(full_name=full_name, chamber="na", party=party))

        if not mps:
            raise ParserSpecGap("Zero MPs parsed from PMG NA list.")

        return ParsedDocument(source_id=self.source_id, mps=mps)
