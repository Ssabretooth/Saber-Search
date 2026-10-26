import json
from pathlib import Path
from decimal import Decimal
from datetime import date

from ingestion.parsers.treasury_etenders import TreasuryEtendersParser
from ingestion.run import _norm_company

FIXTURE = Path(__file__).parent / "fixtures" / "ocds_sample.json"


def test_treasury_etenders_parses_ocds_release():
    doc = TreasuryEtendersParser().parse(
        content=FIXTURE.read_bytes(), content_type="application/json", fetched_url="local",
    )
    assert len(doc.tenders) == 1
    t = doc.tenders[0]
    assert t.ocid == "ocds-test-001"
    assert t.title == "Supply of IT Equipment"
    assert t.department == "Department of Health"
    assert t.winning_company == "Acme Holdings"
    assert t.amount_zar == Decimal("500000.00")
    assert t.award_date == date(2026, 10, 15)


def test_treasury_etenders_skips_release_without_supplier():
    data = {"releases": [{"ocid": "x", "tender": {"title": "T"}, "awards": [{"suppliers": []}]}]}
    doc = TreasuryEtendersParser().parse(
        content=json.dumps(data).encode(), content_type="application/json", fetched_url="local",
    )
    assert doc.tenders == []


def test_norm_company_is_case_and_whitespace_insensitive():
    assert _norm_company("  Acme   Holdings ") == _norm_company("acme holdings")
    assert _norm_company("Acme Holdings") != _norm_company("Acme Holdings Ltd")
