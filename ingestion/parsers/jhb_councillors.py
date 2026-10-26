import io
import re

from pypdf import PdfReader

from ..errors import ParserSpecGap
from ..models import MPSeed, ParsedDocument
from .base import PARSER_VERSION_PREFIX, BaseParser

RECORD_SPLIT = re.compile(r"(?m)^\s*(\d+)\.\s*")
NAME_PARTY = re.compile(r"^([A-Z][A-Za-z'\- ,]*?)\s*\(([^)]+)\)\s*(.*)$")
WARD = re.compile(r"\b(PR|WD\s*\d+(?:/\s*REGION\s*[A-Z])?)\b")


class JhbCouncillorsParser(BaseParser):
    source_id = "jhb_councillors"

    @property
    def parser_version(self) -> str:
        return f"{PARSER_VERSION_PREFIX}+{self.source_id}"

    def parse(self, *, content: bytes, content_type: str,
              fetched_url: str) -> ParsedDocument:
        try:
            reader = PdfReader(io.BytesIO(content))
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as e:
            raise ParserSpecGap(f"Failed to read PDF: {e}") from e

        parts = RECORD_SPLIT.split(text)
        records = [(int(parts[i]), " ".join(parts[i + 1].split()))
                   for i in range(1, len(parts), 2)]
        if not records:
            raise ParserSpecGap("no numbered councillor records found")

        numbers = [n for n, _ in records]
        if len(set(numbers)) != len(numbers):
            raise ParserSpecGap("duplicate record numbers in PDF")

        mps: list[MPSeed] = []
        failed: list[int] = []
        for n, body in records:
            m = NAME_PARTY.match(body)
            if not m:
                failed.append(n)
                continue
            ward = WARD.search(m.group(3))
            mps.append(MPSeed(
                full_name=m.group(1).strip(),
                party=m.group(2).strip(),
                constituency=(
                    f"City of Johannesburg - {ward.group(1)}" if ward else None
                ),
                chamber="local",
                government_level="local",
            ))

        if failed:
            raise ParserSpecGap(
                f"{len(failed)} councillor record(s) did not match layout: {failed}"
            )

        return ParsedDocument(source_id=self.source_id, mps=mps)
