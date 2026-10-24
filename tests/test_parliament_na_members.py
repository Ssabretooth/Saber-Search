import hashlib
import os
from pathlib import Path

import pytest

from ingestion.errors import ParserSpecGap
from ingestion.parsers.parliament_na_members import (
    ParliamentNaMembersParser,
    parse_member_lines,
)

HEADER = "SURNAME NAMES TITLE LIST PARTY"

# sha256 of 260218_NA_MEMBERS_ALPHABETIC.pdf (Parliament list as on 18 Feb 2026)
OFFICIAL_LIST_SHA256 = "7b67455edd7b95ade88110354b8a28d16bf1f29687c0dfe0ae48c6c3228d53d7"
OFFICIAL_LIST_MEMBERS = 398
OFFICIAL_LIST_PATH = os.environ.get(
    "NA_MEMBERS_PDF",
    str(Path.home() / "Desktop" / "260218_NA_MEMBERS_ALPHABETIC.pdf"),
)


def test_parses_title_list_and_party():
    lines = [HEADER, "ADAMS FADIEL Mr National NCC", "ADAMS  RACHEL CECILIA Ms  National  ANC  "]
    assert parse_member_lines(lines) == [
        ("Adams, Mr. Fadiel", "NCC"),
        ("Adams, Ms. Rachel Cecilia", "ANC"),
    ]


def test_strips_footnote_markers():
    lines = [HEADER, "ARRIES15 LAETITIA HELOISE Ms NW EFF", "BOSHIELOc SHELA POLLY Dr National ANC"]
    assert parse_member_lines(lines) == [
        ("Arries, Ms. Laetitia Heloise", "EFF"),
        ("Boshielo, Dr. Shela Polly", "ANC"),
    ]


def test_joins_wrapped_multi_word_surname():
    lines = [HEADER, "DE BLOCQ VAN", "SCHELTINGA", "ANDREW DIRK Mr GP DA"]
    assert parse_member_lines(lines) == [("De Blocq Van Scheltinga, Mr. Andrew Dirk", "DA")]


def test_joins_hyphen_wrapped_surname():
    lines = [HEADER, "LITCHFIELD-", "TSHABALALA32 KHANYISILE Dr GP MK"]
    assert parse_member_lines(lines) == [("Litchfield-Tshabalala, Dr. Khanyisile", "MK")]


def test_repeated_page_header_does_not_leak_into_next_record():
    lines = [
        HEADER,
        "ABADER ZELNA SAIRA Ms GP MK",
        HEADER,
        "BURKE MARK JOHN Dr  WC DA",
    ]
    assert parse_member_lines(lines) == [
        ("Abader, Ms. Zelna Saira", "MK"),
        ("Burke, Dr. Mark John", "DA"),
    ]


def test_honorifics_and_hyphenated_given_names():
    lines = [
        HEADER,
        "BURNS-NCAMASHE  ZOLILE Prince EC ANC",
        "BUTHELEZI ELPHAS MFAKAZELENI Inkosi KZN IFP",
        "DUNJWA MARY-ANN LINDELWA Ms EC ANC",
        "VAN STADEN PHILIPPUS ADRIAAN Mr GP FF PLUS",
    ]
    assert parse_member_lines(lines) == [
        ("Burns-Ncamashe, Prince Zolile", "ANC"),
        ("Buthelezi, Inkosi Elphas Mfakazeleni", "IFP"),
        ("Dunjwa, Ms. Mary-Ann Lindelwa", "ANC"),
        ("Van Staden, Mr. Philippus Adriaan", "FF Plus"),
    ]


def test_missing_header_is_a_spec_gap():
    with pytest.raises(ParserSpecGap, match="header not found"):
        parse_member_lines(["ADAMS FADIEL Mr National NCC"])


def test_wrong_content_type_is_a_spec_gap():
    with pytest.raises(ParserSpecGap, match="format not verified"):
        ParliamentNaMembersParser().parse(
            content=b"%PDF", content_type="text/html", fetched_url="https://example.org/x.pdf"
        )


def test_no_members_is_a_spec_gap():
    with pytest.raises(ParserSpecGap):
        ParliamentNaMembersParser().parse(
            content=b"", content_type="application/pdf", fetched_url="https://example.org/x.pdf"
        )


@pytest.mark.skipif(
    not Path(OFFICIAL_LIST_PATH).exists(),
    reason="official Parliament member list PDF not present (set NA_MEMBERS_PDF)",
)
def test_official_list_pdf_matches_reference_hash_and_count():
    content = Path(OFFICIAL_LIST_PATH).read_bytes()
    assert hashlib.sha256(content).hexdigest() == OFFICIAL_LIST_SHA256

    doc = ParliamentNaMembersParser().parse(
        content=content, content_type="application/pdf", fetched_url="https://example.org/x.pdf"
    )
    names = [m.full_name for m in doc.mps]
    assert len(names) == OFFICIAL_LIST_MEMBERS
    assert len(set(names)) == OFFICIAL_LIST_MEMBERS
    assert all(m.chamber == "na" for m in doc.mps)
    assert all(m.party for m in doc.mps)
    assert "Adams, Mr. Fadiel" in names
    assert "Dlamini, Ms. Mbali" in names
    assert not any("Surname" in n or "Names" in n for n in names)
