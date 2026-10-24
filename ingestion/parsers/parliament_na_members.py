"""Parser for the Parliament of South Africa list of National Assembly members.

Source: "LIST OF MEMBERS (alphabetical)", 7th Parliament, as on a given date.
The table body is "SURNAME  NAMES  TITLE  LIST  PARTY", one member per record.
Records can wrap across lines (multi-word surnames, hyphenated names), and
footnote markers are printed against names (e.g. "ARRIES15", "BOSHIELOc").

Only the official list carries full given names, so this parser is the
authority for MP names. Output names use the form "Surname, Mr. Given Names"
to match the existing `mps` rows.
"""

import io
import re

import pypdf

from ..errors import ParserSpecGap
from ..models import MPSeed, ParsedDocument
from .base import PARSER_VERSION_PREFIX, BaseParser

TABLE_HEADER = "SURNAME NAMES TITLE LIST PARTY"
TITLES = r"Mr|Ms|Mrs|Dr|Adv|Advocate|Prof|Rev|Inkosi|Prince"
LISTS = r"National|GP|KZN|WC|EC|LP|NW|FS|MP|NC"
RECORD = re.compile(
    rf"^(?P<name>.*?)\s+(?P<title>{TITLES})\s+(?P<list>{LISTS})\s+(?P<party>.+?)\s*$"
)

# Surnames printed as several words in the official list.
COMPOUND_SURNAMES = (
    "DE BLOCQ VAN SCHELTINGA",
    "VAN DER MERWE",
    "VAN DER WALT",
    "VAN DEN BERG",
    "VAN ROOYEN",
    "VAN STADEN",
    "VAN WYK",
    "VAN ZYL",
    "DE LILLE",
    "DE VILLIERS",
    "LE ROUX",
)

# Titles printed with a dot in the canonical name. Honorifics such as
# "Inkosi" and "Prince" are printed as-is.
DOTTED_TITLES = {"Mr", "Ms", "Mrs", "Dr", "Adv", "Prof", "Rev"}

# Party labels as printed, mapped to one spelling.
PARTY_ALIASES = {"FF PLUS": "FF Plus"}

PARSER_VERSION = f"{PARSER_VERSION_PREFIX}+parliament_na_members"


def _clean_token(token: str) -> str:
    token = token.strip("*#")
    token = re.sub(r"\d+$", "", token)  # footnote digits: ARRIES15
    # footnote letter appended to an uppercase word: BOSHIELOc
    if re.fullmatch(r"[A-Za-z\-]{2,}[a-z]", token) and token[-2].isupper():
        token = token[:-1]
    return token


def _cap(word: str) -> str:
    return "-".join(part[:1].upper() + part[1:].lower() for part in word.split("-"))


def _title_case(words: list[str]) -> str:
    return " ".join(_cap(w) for w in words if w)


def _split_surname(tokens: list[str]) -> tuple[list[str], list[str]]:
    upper = " ".join(tokens)
    for compound in COMPOUND_SURNAMES:
        if upper == compound or upper.startswith(compound + " "):
            n = len(compound.split())
            return tokens[:n], tokens[n:]
    return tokens[:1], tokens[1:]


def _canonical_name(name_part: str, title: str) -> str:
    tokens = [_clean_token(t) for t in name_part.replace("*", " ").split()]
    # a lone lowercase footnote letter printed after a name: "GRAHAM-MARÉ a"
    tokens = [t for t in tokens if t and not re.fullmatch(r"[a-z]", t)]
    surname_tokens, given_tokens = _split_surname(tokens)
    if not surname_tokens or not given_tokens:
        raise ParserSpecGap(f"cannot split name: {name_part!r}")
    surname = _title_case(surname_tokens)
    given = _title_case(given_tokens)
    shown_title = f"{title}." if title in DOTTED_TITLES else title
    return f"{surname}, {shown_title} {given}"


def parse_member_lines(lines: list[str]) -> list[tuple[str, str]]:
    """Return (canonical_name, party) for each member record in the table body."""
    start = next(
        (i for i, line in enumerate(lines) if line.strip().startswith(TABLE_HEADER)),
        None,
    )
    if start is None:
        raise ParserSpecGap("member table header not found in list")

    members: list[tuple[str, str]] = []
    buffer = ""
    for raw in lines[start + 1:]:
        line = raw.strip()
        if not line:
            continue
        if line.startswith(TABLE_HEADER):  # repeated at each page break
            buffer = ""
            continue
        if buffer.endswith("-"):
            buffer = buffer + line
        else:
            buffer = f"{buffer} {line}".strip()
        match = RECORD.match(buffer)
        if not match:
            continue
        name = _canonical_name(match.group("name"), match.group("title"))
        party = " ".join(match.group("party").split())
        members.append((name, PARTY_ALIASES.get(party.upper(), party)))
        buffer = ""
    return members


class ParliamentNaMembersParser(BaseParser):
    source_id = "parliament_na_members"

    @property
    def parser_version(self) -> str:
        return PARSER_VERSION

    def parse(self, *, content: bytes, content_type: str, fetched_url: str) -> ParsedDocument:
        if "pdf" not in content_type.lower():
            raise ParserSpecGap(f"format not verified: {content_type!r}")

        try:
            reader = pypdf.PdfReader(io.BytesIO(content))
            lines: list[str] = []
            for page in reader.pages:
                lines.extend((page.extract_text() or "").splitlines())
        except Exception as e:  # pypdf raises several types for unreadable PDFs
            raise ParserSpecGap(f"cannot read member list PDF: {e}") from e

        members = parse_member_lines(lines)
        if not members:
            raise ParserSpecGap("Zero MPs parsed from Parliament NA member list.")

        seen: set[str] = set()
        mps: list[MPSeed] = []
        for name, party in members:
            if name in seen:
                raise ParserSpecGap(f"duplicate member in official list: {name!r}")
            seen.add(name)
            mps.append(MPSeed(full_name=name, chamber="na", party=party))

        return ParsedDocument(source_id=self.source_id, mps=mps)
