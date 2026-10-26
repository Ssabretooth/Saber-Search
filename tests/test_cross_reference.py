from unittest.mock import MagicMock

from ingestion.run import _cross_reference_tenders, _norm_company


def _writer(disclosures, tenders, existing_flags):
    writer = MagicMock()
    tables = {}

    def table(name):
        if name not in tables:
            query = MagicMock()
            data = {
                "financial_disclosures": disclosures,
                "tenders": tenders,
                "review_flags": existing_flags,
            }[name]
            query.select.return_value.execute.return_value.data = data
            query.select.return_value.eq.return_value.execute.return_value.data = data
            query.select.return_value.execute.return_value.data = data
            query.select.return_value.in_.return_value.execute.return_value.data = data
            tables[name] = query
        return tables[name]

    writer.client.table.side_effect = table
    return writer, tables


def test_cross_reference_inserts_draft_flag_for_matching_directorship():
    writer, tables = _writer(
        disclosures=[{"mp_id": "mp-1", "counterparty": "Acme Holdings", "category": "directorship"}],
        tenders=[{"id": "t-1", "ocid": "ocds-1", "winning_company": "ACME HOLDINGS"}],
        existing_flags=[],
    )

    assert _cross_reference_tenders(writer, "doc-1") == 1

    tables["review_flags"].insert.assert_called_once()
    payload = tables["review_flags"].insert.call_args[0][0][0]
    assert payload["subject_id"] == "mp-1"
    assert payload["flag_type"] == "procurement_relationship"
    assert payload["status"] == "draft"
    assert payload["inputs"]["tender_id"] == "t-1"
    assert payload["inputs"]["company"] == "ACME HOLDINGS"


def test_cross_reference_skips_existing_flag():
    writer, tables = _writer(
        disclosures=[{"mp_id": "mp-1", "counterparty": "Acme Holdings", "category": "directorship"}],
        tenders=[{"id": "t-1", "ocid": "ocds-1", "winning_company": "ACME HOLDINGS"}],
        existing_flags=[{"subject_id": "mp-1", "inputs": {"tender_id": "t-1"}}],
    )

    assert _cross_reference_tenders(writer, "doc-1") == 0
    tables["review_flags"].insert.assert_not_called()


def test_cross_reference_skips_jse_listed_company():
    writer, tables = _writer(
        disclosures=[{"mp_id": "mp-1", "counterparty": "Vodacom Group", "category": "directorship"}],
        tenders=[{"id": "t-1", "ocid": "ocds-1", "winning_company": "Vodacom"}],
        existing_flags=[],
    )

    assert _cross_reference_tenders(writer, "doc-1") == 0
    tables["review_flags"].insert.assert_not_called()


def test_name_normalisation():
    assert _norm_company("  Acme   Holdings ") == "acme"
    assert _norm_company("ACME HOLDINGS") == "acme"
    assert _norm_company("Acme Holdings Ltd") == _norm_company("Acme Holdings")
    assert _norm_company("Acme Holdings") != _norm_company("Beta Holdings")
