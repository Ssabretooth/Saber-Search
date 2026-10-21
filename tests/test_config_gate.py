import pytest
from ingestion.config import load_cleared_sources
from ingestion.errors import SourceNotClearedError

def test_missing_lock_file(tmp_path):
    with pytest.raises(SourceNotClearedError):
        load_cleared_sources(tmp_path / "nope.yaml")

def test_empty_sources_list(tmp_path, lock_file):
    p = lock_file(entries=[])
    with pytest.raises(SourceNotClearedError):
        load_cleared_sources(p)

def test_duplicate_ids(tmp_path, lock_file):
    entry = {
        "id": "dup", "publisher": "P", "title": "T",
        "url": "https://example.test/x.pdf", "format": "pdf", "tier": "tier1_official",
        "licence_note": "Reproduction permitted under terms", "contact_email": "x@publikeye.org",
        "rate_limit_rps": 0.5, "candidate_domain": "example.test",
        "verified": True, "robots_ok": True, "verified_by": "human", "verified_at": "2026-01-01",
        "first_fetch_sha256": "0" * 64,
    }
    p = lock_file(entries=[entry, dict(entry)])
    with pytest.raises(SourceNotClearedError):
        load_cleared_sources(p)

@pytest.mark.parametrize(
    "field,value",
    [
        ("id", ""), ("publisher", ""), ("title", ""),
        ("url", "http://example.test/doc.pdf"),
        ("candidate_domain", "different.test"),
        ("format", "docx"), ("tier", "tier9"),
        ("licence_note", "short"), ("contact_email", "nope"),
        ("verified", False), ("robots_ok", False),
        ("verified_by", ""), ("verified_at", ""),
        ("first_fetch_sha256", "abc"), ("rate_limit_rps", 3.0),
    ],
)
def test_field_rejection(lock_file, field, value):
    overrides = {field: value}
    p = lock_file(overrides=overrides)
    with pytest.raises(SourceNotClearedError):
        load_cleared_sources(p)

def test_valid_entry_roundtrip(lock_file):
    p = lock_file()
    sources = load_cleared_sources(p)
    cs = sources["example_source"]
    assert cs.id == "example_source"
    assert cs.publisher == "Example Publisher"
    assert cs.url == "https://example.test/doc.pdf"
    assert cs.format == "pdf"
    assert cs.tier == "tier1_official"
    assert cs.rate_limit_rps == 0.5

def test_get_source_missing_id(lock_file, monkeypatch):
    p = lock_file()
    monkeypatch.setenv("PUBLIKEYE_LOCK", str(p))
    import importlib
    import ingestion.config as cfg
    importlib.reload(cfg)
    with pytest.raises(cfg.SourceNotClearedError):
        cfg.get_source("missing_id")
