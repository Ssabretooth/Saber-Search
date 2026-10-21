from ..errors import ParserSpecGap
from ..models import ParsedDocument
from .base import PARSER_VERSION_PREFIX, BaseParser


class SafliiJudgmentsParser(BaseParser):
    source_id = "saflii_judgments"

    @property
    def parser_version(self) -> str:
        return f"{PARSER_VERSION_PREFIX}+{self.source_id}"

    def parse(self, *, content: bytes, content_type: str, fetched_url: str) -> ParsedDocument:
        raise ParserSpecGap("Layout not verified.")
