"""Parser for the Parliament Register of Members' Interests (PDF).

Uses pypdf layout-mode extraction to preserve column positions, then splits
each data row by 2+ space runs to recover the original column values:
  counterparty, description, value_zar.

POPIA guardrail: for sections 9 and 11 (land/property) the "Area where
Property is Located" column is stripped to province name only — suburb,
street and erf details are discarded before any row is stored.
"""

import io
import logging
import re
from decimal import Decimal, InvalidOperation

from pypdf import PdfReader

from ..errors import ParserSpecGap
from ..models import DisclosureRow, MPSeed, ParsedDocument
from .base import PARSER_VERSION_PREFIX, BaseParser

log = logging.getLogger("publikeye.ingestion")

# (section_start_prefix_upper, category, [col0_role, col1_role, col2_role, col3_role])
# roles: 'counterparty' | 'description' | 'value' | 'province' | None (discard)
# 'province': POPIA-safe extraction — keeps only the SA province name from
#   the location column, discarding suburb/street/erf details.
_SECTIONS = [
    ("1. SHARES",        "shareholding",    ["counterparty", "description", "description", "value"]),
    ("2. REMUNERATED",   "paid_employment", ["counterparty", "description"]),
    ("3. DIRECTORSHIPS", "directorship",    ["counterparty", "description"]),
    ("4. CONSULTANCIES", "consultancy",     ["counterparty", "description"]),
    ("5. SPONSORSHIPS",  "other",           ["counterparty", "description", None]),
    ("6. GIFTS",         "gift_hospitality",["description",  "value",        "counterparty"]),
    ("7. BENEFITS",      "other",           ["counterparty", "description"]),
    ("8. TRAVEL",        "foreign_travel",  ["counterparty", "description",  "description"]),
    # 9 / 11: location column → province only (POPIA: street/suburb discarded)
    ("9. OWNERSHIP IN LAND", "land_property", ["description", "province", "description"]),
    ("9. LAND AND PROPERTY", "land_property", ["description", "province", "description"]),
    ("11. RENTED PROPERTY",  "land_property", ["description", "province", "description"]),
    ("10. PENSIONS",     "other",           ["counterparty", "description"]),
    ("12. INCOME",       "other",           ["description",  "description"]),
    ("13. TRUSTS",       "other",           ["counterparty", "description"]),
]

_SECTION_MAP = {pfx: (cat, cols) for pfx, cat, cols in _SECTIONS}
_POPIA_SKIP: set[str] = set()  # section 9/11 now parsed with province-only extraction

# Regex matching the nine SA provinces — used to strip location to province only
_SA_PROVINCE_RE = re.compile(
    r"\b(gauteng|western cape|eastern cape|kwazulu[\-\s]natal|limpopo|mpumalanga"
    r"|northern cape|north[\s\-]west|free state)\b",
    re.I,
)

_PLACEHOLDER = re.compile(
    r"^\s*(nothing to disclose|none|n/a|not applicable|no disclosure)\s*$", re.I
)
# Catches street addresses like "18 Acacia Road" that may appear in the description
# column due to PDF column-boundary misreads on some MPs' Section 9/11 entries.
_STREET_ADDR_RE = re.compile(
    r"\b\d+\s+\w[\w\s]{0,30}?\s+"
    r"(street|road|avenue|drive|boulevard|lane|close|crescent|place|way|rd\b|st\b|ave\b)",
    re.I,
)
_HEADER_WORDS = re.compile(
    r"^(name of|type of|number of|nature of|nominal value|source of|description of|"
    r"purpose of|area where|size of|public/\s*private|trustee/\s*beneficiary|"
    r"duration of|description and purpose|description\b|source\b|value\b|journey\b|"
    # section 9/11 column-header continuation lines that wrap onto their own row
    r"located\b|square\b|property and its)", re.I
)
_MP_RE = re.compile(r"^\d+\.\d+\s+(.+?)(?:\s+\.{3,}\s*\d*)?$")
_PARTY_SECTION_RE = re.compile(r"^\d+\.\s+[A-Z][A-Z\s\-]+$")
_ZAR_RE = re.compile(r"R\s*(\d[\d ,]*(?:\.\d{1,2})?)", re.I)


def _split_cols(line: str) -> list[str]:
    """Split a layout-preserved line by 2+ space gaps → list of non-empty column values."""
    return [c.strip() for c in re.split(r" {2,}", line) if c.strip()]


def _extract_zar(text: str) -> Decimal | None:
    m = _ZAR_RE.search(text)
    if not m:
        return None
    clean = m.group(1).replace(" ", "").replace(",", "")
    try:
        d = Decimal(clean)
        return d if d <= _ZAR_MAX else None
    except (InvalidOperation, ValueError, ArithmeticError):
        return None


_ZAR_MAX = Decimal("999999999999.99")  # NUMERIC(14,2) ceiling

def _extract_zar_from_number(text: str) -> Decimal | None:
    clean = text.strip().replace(",", "").replace(" ", "")
    if re.fullmatch(r"\d+(\.\d{1,2})?", clean):
        try:
            d = Decimal(clean)
            return d if 0 < d <= _ZAR_MAX else None
        except (InvalidOperation, ValueError, ArithmeticError):
            pass
    return None


def _build_disclosure(
    mp_full_name: str,
    category: str,
    col_roles: list[str | None],
    row: list[str | None],
) -> DisclosureRow | None:
    desc_parts: list[str] = []
    cpty_parts: list[str] = []
    value_zar: Decimal | None = None

    for i, role in enumerate(col_roles):
        val = row[i] if i < len(row) else None
        if not val or not role:
            continue
        if role == "counterparty":
            cpty_parts.append(val)
        elif role == "description":
            desc_parts.append(val)
        elif role == "value":
            value_zar = _extract_zar(val) or _extract_zar_from_number(val)
        elif role == "province":
            # POPIA: discard suburb/street — keep only the SA province name.
            m = _SA_PROVINCE_RE.search(val)
            if m:
                province = " ".join(w.capitalize() for w in m.group(0).split())
                cpty_parts.append(province)
            # If no province is identifiable, nothing is recorded — no guessing.

    desc = " — ".join(p for p in desc_parts if p) or None
    cpty = " / ".join(p for p in cpty_parts if p) or None

    # Drop land_property rows whose description contains a street address —
    # these arise when the PDF column boundary is misread and an address ends
    # up in the description column rather than the (province-stripped) location column.
    if category == "land_property" and _STREET_ADDR_RE.search(desc or ""):
        return None

    # Drop rows where everything resolved to placeholder text
    if desc and re.fullmatch(r"(none(\s*[—\-]\s*none)*)", desc.strip(), re.I):
        desc = None

    if not desc and not cpty:
        return None

    return DisclosureRow(
        mp_full_name=mp_full_name,
        category=category,
        description=desc,
        counterparty=cpty,
        value_zar=value_zar,
    )


class ParliamentRegisterInterestsParser(BaseParser):
    source_id = "parliament_register_interests"

    @property
    def parser_version(self) -> str:
        return f"{PARSER_VERSION_PREFIX}+{self.source_id}"

    def parse(self, *, content: bytes, content_type: str, fetched_url: str) -> ParsedDocument:
        if "pdf" not in content_type.lower():
            raise ParserSpecGap(f"format not verified: {content_type!r} for {self.source_id}")
        try:
            reader = PdfReader(io.BytesIO(content))
            pages = []
            for page_no, page in enumerate(reader.pages):
                try:
                    pages.append(page.extract_text(extraction_mode="layout") or "")
                except Exception as exc:
                    log.debug("register: layout extraction failed on page %d, falling back: %s", page_no, exc)
                    pages.append(page.extract_text() or "")
            full_text = "\n".join(pages)
        except Exception as e:
            raise ParserSpecGap(f"PDF extraction failed: {e}")

        return self._parse_text(full_text)

    def _parse_text(self, full_text: str) -> ParsedDocument:
        mps_seen: set[str] = set()
        disclosures: list[DisclosureRow] = []

        current_mp: str | None = None
        current_cat: str | None = None
        current_cols: list[str | None] = []
        skip_section = False

        # Accumulator for the current row (multi-line cells)
        # col_x: approximate char-column start for each data column, set on first line
        pending: list[str | None] = []
        col_x: list[int] = []

        def flush():
            nonlocal pending, col_x
            if pending and current_mp and current_cat:
                d = _build_disclosure(current_mp, current_cat, current_cols, pending)
                if d:
                    disclosures.append(d)
            pending = []
            col_x = []

        for raw_line in full_text.split("\n"):
            line_stripped = raw_line.rstrip()
            line = line_stripped.strip()

            if not line or line.isdigit():
                continue
            if "....." in line or " . . " in line:
                continue

            upper = line.upper()

            # MP entry header: "2.1 Beesley, Mr. Alan David"
            mp_m = _MP_RE.match(line)
            if mp_m:
                name = mp_m.group(1).strip()
                if not re.search(r"\d$", name) and re.match(r"[A-Za-z][A-Za-z'\- ()]*,\s", name):
                    flush()
                    current_mp = name
                    mps_seen.add(name)
                    current_cat = None
                    current_cols = []
                    skip_section = False
                    continue

            # POPIA skip
            if any(upper.startswith(s) for s in _POPIA_SKIP):
                flush()
                current_cat = None
                current_cols = []
                skip_section = True
                continue

            # Disclosure section header — check BEFORE party-header skip so that
            # "1. SHARES AND OTHER…" is not swallowed by _PARTY_SECTION_RE
            matched_section = None
            for pfx, (cat, cols) in _SECTION_MAP.items():
                if upper.startswith(pfx):
                    matched_section = (cat, cols)
                    break

            if matched_section:
                flush()
                current_cat, current_cols = matched_section
                skip_section = False
                continue

            # Party section header "2.  ACTIONSA" — skip after section check
            if _PARTY_SECTION_RE.match(line):
                continue

            if skip_section or not current_mp or not current_cat:
                continue

            if _HEADER_WORDS.match(upper):
                continue
            if _PLACEHOLDER.match(line):
                continue

            # --- Column splitting ---
            cols_values = _split_cols(line_stripped)
            if not cols_values:
                continue

            n = len(current_cols)

            # Continuation: a 1-token line that only wraps the first column of a
            # pending row (e.g. "Ltd" continuing "Gap Investments (Pty)").
            # Everything else is a new record — flush the previous row first.
            if pending and col_x and len(cols_values) == 1:
                # Append the single token to the first column
                existing = pending[0]
                pending[0] = f"{existing} {cols_values[0]}" if existing else cols_values[0]
            else:
                flush()
                pending = [None] * n
                col_x = []
                sf = 0
                for i, cv in enumerate(cols_values[:n]):
                    idx = line_stripped.find(cv, sf)
                    pending[i] = cv
                    col_x.append(max(idx, 0))
                    sf = idx + len(cv)

        flush()

        if not mps_seen:
            raise ParserSpecGap("Zero MPs parsed from register.")

        return ParsedDocument(
            source_id=self.source_id,
            mps=[MPSeed(full_name=m, chamber="na") for m in mps_seen],
            disclosures=disclosures,
        )
