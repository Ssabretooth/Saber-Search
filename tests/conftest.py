import pytest
import yaml

BASE_VALID_ENTRY = {
    "id": "example_source",
    "publisher": "Example Publisher",
    "title": "Example Title",
    "url": "https://example.test/doc.pdf",
    "format": "pdf",
    "tier": "tier1_official",
    "licence_note": "Reproduction permitted under example terms",
    "contact_email": "transparency@publikeye.org",
    "rate_limit_rps": 0.5,
    "candidate_domain": "example.test",
    "verified": True,
    "robots_ok": True,
    "verified_by": "human-tester",
    "verified_at": "2026-01-01",
    "first_fetch_sha256": "0" * 64,
    "republication_of": None,
    "default_chamber": "na",
}

@pytest.fixture
def lock_file(tmp_path):
    def _make(entries=None, overrides=None):
        entry = dict(BASE_VALID_ENTRY)
        if overrides:
            entry.update(overrides)
        entries = entries if entries is not None else [entry]
        p = tmp_path / "sources.lock.yaml"
        p.write_text(yaml.safe_dump({"sources": entries}))
        return p
    return _make
