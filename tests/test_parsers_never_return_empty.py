import pytest
from ingestion.errors import ParserSpecGap
from ingestion.parsers.parliament_register_interests import ParliamentRegisterInterestsParser

def test_stub_raises_on_pdf():
    p = ParliamentRegisterInterestsParser()
    with pytest.raises(ParserSpecGap):
        p.parse(content=b"%PDF-1.4 fake", content_type="application/pdf", fetched_url="https://example.test/x.pdf")

def test_stub_raises_on_html():
    p = ParliamentRegisterInterestsParser()
    with pytest.raises(ParserSpecGap):
        p.parse(content=b"<html></html>", content_type="text/html", fetched_url="https://example.test/x.html")

def test_stub_never_returns_parsed_document():
    p = ParliamentRegisterInterestsParser()
    for ct in ("application/pdf", "text/html", "application/json", ""):
        try:
            p.parse(content=b"", content_type=ct, fetched_url="https://example.test/x")
        except ParserSpecGap:
            continue
        pytest.fail(f"parser returned a document for content_type={ct!r}")
