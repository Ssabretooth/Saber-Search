import pytest
from ingestion.parsers.pmg_na_members import PmgNaMembersParser
from ingestion.parsers.nationalgov_ncop_members import NationalGovNcopMembersParser
from ingestion.errors import ParserSpecGap


def test_pmg_na_members_parser_basic():
    parser = PmgNaMembersParser()
    html = b"""
    <html>
    <body>
    Abader, Ms ZS MKP
    Abrahams, Mr B ANC
    </body>
    </html>
    """
    doc = parser.parse(content=html, content_type="text/html", fetched_url="https://pmg.org.za/members/")
    assert len(doc.mps) == 2
    assert doc.mps[0].full_name == "Abader, Ms ZS"
    assert doc.mps[0].chamber == "na"
    assert doc.mps[1].full_name == "Abrahams, Mr B"


def test_pmg_na_members_parser_zero_mps():
    parser = PmgNaMembersParser()
    html = b"<html><body>No members here</body></html>"
    with pytest.raises(ParserSpecGap, match="Zero MPs parsed"):
        parser.parse(content=html, content_type="text/html", fetched_url="https://pmg.org.za/members/")


def test_pmg_na_members_parser_wrong_content_type():
    parser = PmgNaMembersParser()
    with pytest.raises(ParserSpecGap, match="format not verified"):
        parser.parse(content=b"some data", content_type="application/pdf", fetched_url="https://pmg.org.za/members/")


def test_nationalgov_ncop_members_parser_basic():
    parser = NationalGovNcopMembersParser()
    # The parser anchors on "permanent delegates to the NCOP" then scans for
    # title-prefixed names within the blob before the secretary marker.
    html = b"""
    <html>
    <body>
    There are 54 permanent delegates to the NCOP.
    Mr John Doe (ANC) Ms Jane Smith (DA)
    Secretary to the National Council
    </body>
    </html>
    """
    doc = parser.parse(content=html, content_type="text/html", fetched_url="https://nationalgovernment.co.za/...")
    assert len(doc.mps) == 2
    assert doc.mps[0].full_name == "Mr John Doe"
    assert doc.mps[0].chamber == "ncop"
    assert doc.mps[1].full_name == "Ms Jane Smith"


def test_nationalgov_ncop_members_parser_zero_mps():
    parser = NationalGovNcopMembersParser()
    # Anchor is present but no title-prefixed names follow → "Zero NCOP delegates parsed."
    html = b"""
    <html><body>
    There are 54 permanent delegates to the NCOP.
    No names with titles here.
    Secretary to the National Council
    </body></html>
    """
    with pytest.raises(ParserSpecGap, match="Zero NCOP delegates parsed"):
        parser.parse(content=html, content_type="text/html", fetched_url="https://nationalgovernment.co.za/...")


def test_nationalgov_ncop_members_parser_wrong_content_type():
    parser = NationalGovNcopMembersParser()
    with pytest.raises(ParserSpecGap, match="format not verified"):
        parser.parse(content=b"some data", content_type="application/pdf", fetched_url="https://nationalgovernment.co.za/...")
