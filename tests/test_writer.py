import pytest
from unittest.mock import MagicMock, patch
from ingestion.writer import SupabaseWriter
from ingestion.config import ClearedSource
from ingestion.errors import PublikEyeError

@pytest.fixture
def mock_client():
    with patch("ingestion.writer.create_client") as mock_create:
        client = MagicMock()
        mock_create.return_value = client
        yield client

@pytest.fixture
def mock_source():
    return ClearedSource(
        id="test", publisher="P", title="T", url="https://example.test",
        format="pdf", tier="tier1_official", licence_note="licence",
        contact_email="test@example.org", rate_limit_rps=0.5, republication_of=None,
        default_chamber="na",
        first_fetch_sha256="0"*64,
    )

def test_register_source_document(mock_client, mock_source):
    writer = SupabaseWriter("http://url", "key")
    mock_client.table().upsert().execute.return_value = MagicMock(data=[{"id": "doc123"}])

    # Reset mock to ignore the setup call
    mock_client.table().upsert.reset_mock()

    doc_id = writer.register_source_document(
        source=mock_source, content=b"x", sha256_hex="abc", fetched_url="url"
    )
    assert doc_id == "doc123"
    mock_client.table.assert_called_with("source_documents")
    mock_client.table().upsert.assert_called_once()
    _, kwargs = mock_client.table().upsert.call_args
    assert kwargs["on_conflict"] == "source_id,sha256"

def test_upsert_facts_chunking(mock_client):
    writer = SupabaseWriter("http://url", "key")
    rows = [{"id": i} for i in range(1200)]
    mock_client.table().upsert().execute.return_value = MagicMock(data=[1])

    # Reset mock to ignore the setup call
    mock_client.table().upsert.reset_mock()

    writer.upsert_facts(table="fact_table", rows=rows, conflict_cols="id")
    assert mock_client.table().upsert.call_count == 3 # 500, 500, 200

def test_upsert_facts_never_overwrites_existing_rows(mock_client):
    writer = SupabaseWriter("http://url", "key")
    mock_client.table().upsert().execute.return_value = MagicMock(data=[1])
    mock_client.table().upsert.reset_mock()

    writer.upsert_facts(table="fact_table", rows=[{"row_hash": "h"}], conflict_cols="row_hash")
    assert mock_client.table().upsert.call_args.kwargs["ignore_duplicates"] is True

def test_get_mps_by_name_rejects_ambiguous_names(mock_client):
    writer = SupabaseWriter("http://url", "key")
    mock_client.table().select().execute.return_value = MagicMock(data=[
        {"id": "a", "full_name": "Jane Doe"},
        {"id": "b", "full_name": "jane doe "},
    ])
    with pytest.raises(PublikEyeError, match="ambiguous MP name"):
        writer.get_mps_by_name()

def test_quarantine_private_schema(mock_client, mock_source):
    writer = SupabaseWriter("http://url", "key")
    writer.quarantine(
        source=mock_source, http_status=500, error_class="Test",
        error_detail="Err", raw_sha256="abc", raw_payload=b"bytes"
    )
    mock_client.schema.assert_called_with("private")
    mock_client.schema().table.assert_called_with("ingest_quarantine")
    args, _ = mock_client.schema().table().insert.call_args
    assert args[0]["raw_payload"] == "\\x6279746573"
