import pytest
import respx
import httpx
from ingestion.config import ClearedSource
from ingestion.http_client import fetch
from ingestion.errors import SourceGateError

@pytest.fixture
def mock_source():
    return ClearedSource(
        id="test", publisher="P", title="T",
        url="https://example.test/doc.pdf",
        format="pdf", tier="tier1_official",
        licence_note="Reproduction permitted", contact_email="test@example.org",
        rate_limit_rps=2.0, republication_of=None,
        default_chamber="na",
    )

@respx.mock
def test_robots_disallow(mock_source):
    respx.get("https://example.test/robots.txt").respond(200, text="User-agent: *\nDisallow: /")
    with pytest.raises(SourceGateError, match="robots.txt disallows"):
        fetch(mock_source)

@respx.mock
def test_robots_404_allows(mock_source):
    respx.get("https://example.test/robots.txt").respond(404)
    respx.get("https://example.test/doc.pdf").respond(200, content=b"pdf data")
    res = fetch(mock_source)
    assert res.content == b"pdf data"

@respx.mock
def test_retry_on_500(mock_source):
    respx.get("https://example.test/robots.txt").respond(404)
    route = respx.get("https://example.test/doc.pdf").mock(side_effect=[
        httpx.Response(500),
        httpx.Response(500),
        httpx.Response(200, content=b"success")
    ])
    res = fetch(mock_source, retries=3)
    assert res.content == b"success"
    assert route.call_count == 3

@respx.mock
def test_exhausted_retries(mock_source):
    respx.get("https://example.test/robots.txt").respond(404)
    route = respx.get("https://example.test/doc.pdf").respond(500)
    with pytest.raises(SourceGateError, match="fetch failed after 2 attempts"):
        fetch(mock_source, retries=2)
    assert route.call_count == 2
