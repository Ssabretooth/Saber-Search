from pathlib import Path

import pytest

from ingestion.errors import ParserSpecGap
from ingestion.parsers.treasury_municipalities import TreasuryMunicipalitiesParser

CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "treasury_municipalities.csv"
HEADER = (
    "Demarcation Code,Name,Long Name,Parent Municipality Code,Province Name,"
    "Province Code,Category,MIIF Category,Postal Address part 1,Postal Address part 2,"
    "Postal Address part 3,Street Address part 1,Street Address part 2,"
    "Street Address part 3,Street Address part 4,Phone Number,Fax Number,URL,Population"
)


def _parse(body: str):
    return TreasuryMunicipalitiesParser().parse(
        content=body.encode("utf-8"), content_type="text/csv", fetched_url="x",
    )


def _row(code="EC103", population="10537", url="http://example.org"):
    return f'{code},Ikwezi,"Ikwezi, Eastern Cape",DC10,Eastern Cape,EC,B,B3,,,,,,,,,,{url},"{population}"'


def test_parses_real_file_row_for_row():
    content = CSV_PATH.read_bytes()
    doc = TreasuryMunicipalitiesParser().parse(
        content=content, content_type="text/csv", fetched_url="x",
    )
    data_lines = [l for l in content.decode("utf-8-sig").splitlines()[1:] if l.strip()]
    assert len(doc.municipalities) == len(data_lines)
    assert len({m.demarcation_code for m in doc.municipalities}) == len(doc.municipalities)
    assert doc.mps == [] and doc.tenders == []


def test_maps_fields_and_handles_quoted_commas_and_population_commas():
    doc = _parse(f"{HEADER}\n{_row(population='10,537')}\n")
    m = doc.municipalities[0]
    assert m.demarcation_code == "EC103"
    assert m.long_name == "Ikwezi, Eastern Cape"
    assert m.province == "Eastern Cape"
    assert m.category == "B"
    assert m.population == 10537
    assert m.url == "http://example.org"


def test_blank_population_becomes_none():
    doc = _parse(f"{HEADER}\n{_row(population='')}\n")
    assert doc.municipalities[0].population is None


def test_utf8_bom_is_accepted():
    body = "﻿" + f"{HEADER}\n{_row()}\n"
    doc = TreasuryMunicipalitiesParser().parse(
        content=body.encode("utf-8"), content_type="text/csv", fetched_url="x",
    )
    assert doc.municipalities[0].demarcation_code == "EC103"


def test_missing_header_raises():
    with pytest.raises(ParserSpecGap, match="missing CSV headers"):
        _parse("Demarcation Code,Name\nEC103,Ikwezi\n")


def test_non_numeric_population_raises():
    with pytest.raises(ParserSpecGap, match="non-numeric population"):
        _parse(f"{HEADER}\n{_row(population='n/a')}\n")


def test_duplicate_code_raises():
    with pytest.raises(ParserSpecGap, match="duplicate demarcation code"):
        _parse(f"{HEADER}\n{_row()}\n{_row()}\n")


def test_empty_file_raises():
    with pytest.raises(ParserSpecGap, match="no municipality rows"):
        _parse(f"{HEADER}\n")


def test_non_utf8_raises():
    with pytest.raises(ParserSpecGap, match="not UTF-8"):
        TreasuryMunicipalitiesParser().parse(
            content=b"\xff\xfe\x00bad", content_type="text/csv", fetched_url="x",
        )
