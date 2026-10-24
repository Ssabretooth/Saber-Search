import re
import io
from decimal import Decimal
from pypdf import PdfReader

from ..errors import ParserSpecGap
from ..models import ParsedDocument, MPSeed, DisclosureRow
from .base import PARSER_VERSION_PREFIX, BaseParser


PLACEHOLDER_TOKENS = {"none", "n/a", "non", "not", "applicable", "nothing", "to", "declare", "disclose"}
MP_NAME_RE = re.compile(r"^[A-Za-z][A-Za-z'\- ()]*,\s")


def _is_placeholder(text: str) -> bool:
    tokens = re.findall(r"[a-z/]+", text.lower())
    return all(t in PLACEHOLDER_TOKENS for t in tokens)


class ParliamentRegisterInterestsParser(BaseParser):
    source_id = "parliament_register_interests"

    @property
    def parser_version(self) -> str:
        return f"{PARSER_VERSION_PREFIX}+{self.source_id}"

    def parse(self, *, content: bytes, content_type: str, fetched_url: str) -> ParsedDocument:
        if "pdf" not in content_type.lower():
            raise ParserSpecGap(
                f"format not verified: {content_type!r} for {self.source_id}"
            )

        try:
            reader = PdfReader(io.BytesIO(content))
            full_text = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as e:
            raise ParserSpecGap(f"Failed to extract text from PDF: {e}")

        return self.parse_text(full_text)

    def parse_text(self, full_text: str) -> ParsedDocument:
        mps_set = set()
        disclosures = []

        current_mp = None
        current_section = None
        skip_section = False
        last_disclosure = None

        # POPIA Guardrail
        skip_sections = ["9. OWNERSHIP IN LAND", "9. LAND AND PROPERTY", "11. RENTED PROPERTY"]

        # Junk headers and empty rows
        header_prefixes = [
            "SOURCE OF", "SOURCE DESCRIPTION", "DESCRIPTION", "DURATION OF",
            "PURPOSE", "SPONSOR", "JOURNEY", "NAME OF", "TYPE OF",
            "NUMBER OF", "NATURE OF", "NOMINAL VALUE", "PROPERTY AND ITS USAGE",
            "AREA WHERE PROPERTY", "DESCRIPTION OF RENTED",
        ]

        for line in full_text.split('\n'):
            line = line.strip()
            if not line or line.isdigit():
                continue

            # Skip TOC dot leaders
            if '....' in line or ' . . ' in line:
                continue

            upper_line = line.upper()

            # MP Match: captures full name, ignores trailing TOC dots/numbers
            mp_match = re.match(r'^\d+\.\d+\s+(.+?)(?:\s+\.{3,}|\s+\d+)?$', line)
            if mp_match:
                name = mp_match.group(1).strip()
                if re.search(r'\d+$', name) or not MP_NAME_RE.match(name):
                    continue
                current_mp = name
                mps_set.add(current_mp)
                current_section = None
                skip_section = False
                last_disclosure = None
                continue

            # Section Matching
            new_section = None
            if upper_line.startswith("1. SHARES"): new_section = "shareholding"
            elif upper_line.startswith("2. REMUNERATED"): new_section = "paid_employment"
            elif upper_line.startswith("3. DIRECTORSHIPS"): new_section = "directorship"
            elif upper_line.startswith("4. CONSULTANCIES"): new_section = "consultancy"
            elif upper_line.startswith("5. SPONSORSHIPS"): new_section = "other"
            elif upper_line.startswith("6. GIFTS"): new_section = "gift_hospitality"
            elif upper_line.startswith("7. BENEFITS"): new_section = "other"
            elif upper_line.startswith("8. TRAVEL"): new_section = "foreign_travel"
            elif upper_line.startswith("10. PENSIONS"): new_section = "other"
            elif upper_line.startswith("12. INCOME"): new_section = "other"
            elif upper_line.startswith("13. TRUSTS"): new_section = "other"

            if new_section:
                current_section = new_section
                skip_section = False
                last_disclosure = None
                continue

            # POPIA Skips
            if any(upper_line.startswith(s) for s in skip_sections):
                current_section = None
                skip_section = True
                last_disclosure = None
                continue

            # Party Headers
            if re.match(r'^\d+\.\s+[A-Z\s]+$', line) and len(line) < 30:
                continue

            if skip_section or not current_mp or not current_section:
                continue

            if any(upper_line.startswith(h) for h in header_prefixes):
                continue
            if _is_placeholder(line):
                continue

            # Extract ZAR
            value_zar = None
            val_match = re.search(r'R\s*(\d[\d ,]*(?:\.\d{1,2})?)(?:\s|$)', line)
            if val_match:
                clean_val = val_match.group(1).replace(' ', '').replace(',', '')
                if re.fullmatch(r'\d+(?:\.\d{1,2})?', clean_val):
                    value_zar = Decimal(clean_val)

            # Safer Continuation logic: only merge if line is short and lacks a value
            if last_disclosure and not value_zar and len(line) < 40:
                last_disclosure.description += f" {line}"
                continue

            disc = DisclosureRow(
                mp_full_name=current_mp,
                category=current_section,
                description=line,
                value_zar=value_zar,
            )
            disclosures.append(disc)
            last_disclosure = disc

        if not mps_set:
            raise ParserSpecGap("Zero MPs parsed.")

        return ParsedDocument(
            source_id=self.source_id,
            mps=[MPSeed(full_name=m, chamber="na") for m in mps_set],
            disclosures=disclosures
        )
