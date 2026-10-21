import pytest
from unittest.mock import patch, MagicMock
from ingestion.run import run
from ingestion.errors import SourceGateError, ParserSpecGap, SourceNotClearedError
from ingestion.config import ClearedSource
from ingestion.models import ParsedDocument, MPSeed, DisclosureRow

@pytest.fixture
def mock_source():
    return ClearedSource(
        id="test", publisher="P", title="T", url="https://example.test",
        format="pdf", tier="tier1_official", licence_note="licence",
        contact_email="test@example.org", rate_limit_rps=0.5, republication_of=None,
        default_chamber="na",
    )

@patch("ingestion.run.fetch")
@patch("ingestion.run.SupabaseWriter")
@patch("ingestion.run.get_source")
def test_gate_refusal_never_touches_network(mock_get_source, mock_writer, mock_fetch):
    mock_get_source.side_effect = SourceNotClearedError("missing")
    assert run("test") == 2
    mock_fetch.assert_not_called()
    mock_writer.assert_not_called()

@patch("ingestion.run.get_source")
def test_no_parser_returns_3(mock_get_source, mock_source):
    mock_get_source.return_value = mock_source
    assert run("missing_parser") == 3

@patch("ingestion.run.fetch")
@patch("ingestion.run.SupabaseWriter")
@patch("ingestion.run.get_source")
def test_fetch_error_returns_4(mock_get_source, mock_writer_cls, mock_fetch, mock_source, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://url")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "key")
    mock_get_source.return_value = mock_source
    mock_fetch.side_effect = SourceGateError("fetch fail")
    writer = MagicMock()
    mock_writer_cls.return_value = writer

    assert run("parliament_register_interests") == 4
    writer.quarantine.assert_called_once()
    writer.register_source_document.assert_not_called()

@patch("ingestion.run.fetch")
@patch("ingestion.run.SupabaseWriter")
@patch("ingestion.run.get_source")
@patch("ingestion.run.PARSERS")
def test_parser_spec_gap_returns_5(mock_parsers, mock_get_source, mock_writer_cls, mock_fetch, mock_source, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://url")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "key")
    mock_get_source.return_value = mock_source
    mock_fetch.return_value = MagicMock(content=b"pdf", status=200, content_type="pdf", url="url")
    writer = MagicMock()
    mock_writer_cls.return_value = writer

    parser = MagicMock()
    parser.parser_version = "v1"
    parser.parse.side_effect = ParserSpecGap("mocked gap")
    mock_parsers.__contains__.return_value = True
    mock_parsers.__getitem__.return_value = lambda: parser

    assert run("test") == 5
    writer.quarantine.assert_called_once()
    writer.register_source_document.assert_not_called()

@patch("ingestion.run.fetch")
@patch("ingestion.run.SupabaseWriter")
@patch("ingestion.run.get_source")
@patch("ingestion.run.PARSERS")
def test_unknown_mp_raises_before_write(mock_parsers, mock_get_source, mock_writer_cls, mock_fetch, mock_source, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://url")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "key")
    mock_get_source.return_value = mock_source
    mock_fetch.return_value = MagicMock(content=b"pdf", status=200, content_type="pdf", url="url")
    writer = MagicMock()
    mock_writer_cls.return_value = writer
    writer.register_source_document.return_value = "doc123"
    writer.get_mps_by_name.return_value = {"test mp alpha": "1"}

    parser = MagicMock()
    parser.parser_version = "v1"
    parser.parse.return_value = ParsedDocument(
        source_id="test",
        mps=[MPSeed(full_name="Test MP Alpha", chamber="na")],
        disclosures=[DisclosureRow(mp_full_name="Unknown MP Beta", category="other")]
    )
    mock_parsers.__contains__.return_value = True
    mock_parsers.__getitem__.return_value = lambda: parser

    assert run("test") == 5
    writer.quarantine.assert_called_once()

    # Ensure facts were NEVER written because flatten raised
    assert writer.upsert_facts.call_count == 1
    args, kwargs = writer.upsert_facts.call_args
    assert kwargs["table"] == "mps"
