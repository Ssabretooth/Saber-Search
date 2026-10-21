import hashlib
from abc import ABC, abstractmethod

from ..models import ParsedDocument

PARSER_VERSION_PREFIX = "0.1.0"


class BaseParser(ABC):
    source_id: str

    @property
    @abstractmethod
    def parser_version(self) -> str:
        """Return f'{PARSER_VERSION_PREFIX}+{source_id}'."""

    @abstractmethod
    def parse(self, *, content: bytes, content_type: str,
              fetched_url: str) -> ParsedDocument:
        """Return ParsedDocument or raise ParserSpecGap."""


def sha256_hex(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()
