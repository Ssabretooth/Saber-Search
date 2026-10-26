import csv
import io

from ..errors import ParserSpecGap
from ..models import MunicipalitySeed, ParsedDocument
from .base import PARSER_VERSION_PREFIX, BaseParser

REQUIRED_HEADERS = (
    "Demarcation Code", "Name", "Long Name", "Province Name",
    "Category", "Population", "URL",
)


def _opt(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


class TreasuryMunicipalitiesParser(BaseParser):
    source_id = "treasury_municipalities"

    @property
    def parser_version(self) -> str:
        return f"{PARSER_VERSION_PREFIX}+{self.source_id}"

    def parse(self, *, content: bytes, content_type: str,
              fetched_url: str) -> ParsedDocument:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError as e:
            raise ParserSpecGap(f"not UTF-8: {e}") from e

        reader = csv.DictReader(io.StringIO(text))
        headers = reader.fieldnames or []
        missing = [h for h in REQUIRED_HEADERS if h not in headers]
        if missing:
            raise ParserSpecGap(f"missing CSV headers: {missing}")

        municipalities: list[MunicipalitySeed] = []
        seen: set[str] = set()
        for lineno, row in enumerate(reader, start=2):
            code = (row["Demarcation Code"] or "").strip()
            if code in seen:
                raise ParserSpecGap(f"line {lineno}: duplicate demarcation code {code!r}")
            seen.add(code)

            raw_pop = (row["Population"] or "").strip().replace(",", "")
            if raw_pop:
                if not raw_pop.isdigit():
                    raise ParserSpecGap(
                        f"line {lineno}: non-numeric population {row['Population']!r}"
                    )
                population = int(raw_pop)
            else:
                population = None

            try:
                municipalities.append(MunicipalitySeed(
                    demarcation_code=code,
                    name=(row["Name"] or "").strip(),
                    long_name=_opt(row["Long Name"]),
                    province=_opt(row["Province Name"]),
                    category=_opt(row["Category"]),
                    population=population,
                    url=_opt(row["URL"]),
                ))
            except ValueError as e:
                raise ParserSpecGap(f"line {lineno}: {e}") from e

        if not municipalities:
            raise ParserSpecGap("no municipality rows found")

        return ParsedDocument(
            source_id=self.source_id,
            municipalities=municipalities,
        )
