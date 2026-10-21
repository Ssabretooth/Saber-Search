class PublikEyeError(Exception):
    """Base class for all ingestion errors."""


class SourceNotClearedError(PublikEyeError):
    """Lock file missing, source absent, or a gate field failed."""


class SourceGateError(PublikEyeError):
    """Robots.txt disallows, or fetch failed after retries."""


class ParserSpecGap(PublikEyeError):
    """Parser layout not verified for this document."""


class QuarantineError(PublikEyeError):
    """Quarantine write failed."""
