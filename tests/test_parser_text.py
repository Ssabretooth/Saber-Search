import pytest
from decimal import Decimal
from ingestion.parsers.parliament_register_interests import ParliamentRegisterInterestsParser
from ingestion.errors import ParserSpecGap

def test_parse_text_basic():
    parser = ParliamentRegisterInterestsParser()
    text = """
    1. ACDP
    1.1 Meshoe, Reverend Kenneth
    1. SHARES AND OTHER FINANCIAL INTERESTS
    Name of Company Number of Shares
    Sanlam 100 Subscription shares R15 000
    9. OWNERSHIP IN LAND AND PROPERTY
    Residential House, Sunward Park
    """
    doc = parser.parse_text(text)
    assert len(doc.mps) == 1
    assert doc.mps[0].full_name == "Meshoe, Reverend Kenneth"
    assert len(doc.disclosures) == 1
    assert doc.disclosures[0].value_zar == 15000
    assert doc.disclosures[0].category == "shareholding"

def test_parse_text_zar_with_commas_and_decimals():
    parser = ParliamentRegisterInterestsParser()
    text = """
    1. ACDP
    1.1 Meshoe, Reverend Kenneth
    1. SHARES AND OTHER FINANCIAL INTERESTS
    Sanlam Subscription shares R 15,000.50
    """
    doc = parser.parse_text(text)
    assert doc.disclosures[0].value_zar == Decimal("15000.50")

def test_parse_text_zero_mps():
    parser = ParliamentRegisterInterestsParser()
    with pytest.raises(ParserSpecGap, match="Zero MPs parsed"):
        parser.parse_text("1. SHARES AND OTHER\nNothing to disclose")
