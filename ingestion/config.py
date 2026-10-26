import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

import yaml

from .errors import SourceNotClearedError

LOCK_PATH = Path(os.getenv("PUBLIKEYE_LOCK", "config/sources.lock.yaml"))

Tier = Literal[
    "tier1_official", "tier2_judgment",
    "tier2_indexed_republication", "tier3_media",
]
Format = Literal["pdf", "html", "json", "csv", "mixed"]


@dataclass(frozen=True)
class ClearedSource:
    id: str
    publisher: str
    title: str
    url: str
    format: Format
    tier: Tier
    licence_note: str
    contact_email: str
    rate_limit_rps: float
    republication_of: str | None
    default_chamber: str
    first_fetch_sha256: str


def _check(entry: dict, idx: int) -> ClearedSource:
    where = f"lock entry #{idx} (id={entry.get('id', '?')})"

    def require(field, predicate, reason):
        val = entry.get(field)
        if val is None or val == "" or not predicate(val):
            raise SourceNotClearedError(
                f"{where}: {reason} (field={field}, value={val!r})"
            )
        return val

    sid = require("id", lambda v: isinstance(v, str), "missing id")
    publisher = require(
        "publisher", lambda v: isinstance(v, str) and v.strip(),
        "missing publisher",
    )
    title = require(
        "title", lambda v: isinstance(v, str) and v.strip(),
        "missing title",
    )
    url = require(
        "url", lambda v: isinstance(v, str) and v.startswith("https://"),
        "url must be live https",
    )

    cand = entry.get("candidate_domain")
    if cand:
        host = urlparse(url).hostname or ""
        if host != cand and not host.endswith("." + cand):
            raise SourceNotClearedError(
                f"{where}: host {host!r} does not match "
                f"candidate_domain {cand!r}"
            )

    fmt = require(
        "format", lambda v: v in {"pdf", "html", "json", "csv", "mixed"},
        "unsupported format",
    )
    tier = require(
        "tier",
        lambda v: v in {"tier1_official", "tier2_judgment",
                        "tier2_indexed_republication", "tier3_media"},
        "unknown tier",
    )
    licence = require(
        "licence_note", lambda v: isinstance(v, str) and len(v) > 10,
        "licence_note too short",
    )
    contact = require(
        "contact_email", lambda v: "@" in str(v),
        "contact_email missing",
    )

    if entry.get("verified") is not True:
        raise SourceNotClearedError(f"{where}: verified must be True")
    if entry.get("robots_ok") is not True:
        raise SourceNotClearedError(f"{where}: robots_ok must be True")

    for field in ("verified_by", "verified_at"):
        if not entry.get(field):
            raise SourceNotClearedError(f"{where}: {field} is required")

    sha = entry.get("first_fetch_sha256")
    if not (isinstance(sha, str)
            and len(sha) == 64
            and all(c in "0123456789abcdefABCDEF" for c in sha)):
        raise SourceNotClearedError(
            f"{where}: first_fetch_sha256 must be a 64-char hex digest"
        )

    rps = float(entry.get("rate_limit_rps", 0.5))
    if rps <= 0 or rps > 2:
        raise SourceNotClearedError(
            f"{where}: rate_limit_rps must be in (0, 2]"
        )

    return ClearedSource(
        id=sid, publisher=publisher, title=title, url=url,
        format=fmt, tier=tier, licence_note=licence,
        contact_email=contact, rate_limit_rps=rps,
        republication_of=entry.get("republication_of") or None,
        default_chamber=entry.get("default_chamber", "na"),
        first_fetch_sha256=sha,
    )


def load_cleared_sources(
    path: Path = LOCK_PATH,
) -> dict[str, ClearedSource]:
    if not path.exists():
        raise SourceNotClearedError(
            f"lock file not found at {path}. "
            "Phase 0 must complete before ingestion runs."
        )
    try:
        raw = yaml.safe_load(path.read_text()) or {}
    except yaml.YAMLError as e:
        raise SourceNotClearedError(
            f"lock file not valid YAML: {e}"
        ) from e
    entries = raw.get("sources") or []
    if not entries:
        raise SourceNotClearedError(
            f"{path} has no sources. Complete Phase 0 and re-run."
        )
    cleared: dict[str, ClearedSource] = {}
    for idx, entry in enumerate(entries):
        cs = _check(entry, idx)
        if cs.id in cleared:
            raise SourceNotClearedError(
                f"duplicate source id: {cs.id}"
            )
        cleared[cs.id] = cs
    return cleared


def get_source(source_id: str) -> ClearedSource:
    sources = load_cleared_sources()
    if source_id not in sources:
        raise SourceNotClearedError(
            f"source {source_id!r} is not in the lock file. "
            f"Cleared sources: {sorted(sources)}"
        )
    return sources[source_id]
