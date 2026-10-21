# SUPERSEDED by ingestion/config.py per Module 2 prompt. Kept for audit
# trail only. Do not import from this file.
from __future__ import annotations

from pathlib import Path

import yaml

LOCK_PATH = Path(__file__).resolve().parent.parent / "config" / "sources.lock.yaml"


class SourceNotClearedError(Exception):
    pass


def _https_matches_domain(url: str, domain: str) -> bool:
    if not url.startswith("https://"):
        return False
    host = url[len("https://"):].split("/", 1)[0].split(":", 1)[0]
    return host == domain or host.endswith("." + domain)


def load_cleared_source(source_id: str, lock_path: Path = LOCK_PATH) -> dict:
    if not lock_path.exists():
        raise SourceNotClearedError(f"SPEC_GAP: source {source_id} not cleared for ingestion (lock file missing)")
    data = yaml.safe_load(lock_path.read_text()) or {}
    entries = {s["id"]: s for s in data.get("sources", [])}
    entry = entries.get(source_id)
    if entry is None:
        raise SourceNotClearedError(f"SPEC_GAP: source {source_id} not cleared for ingestion")
    if (
        entry.get("verified") is not True
        or entry.get("robots_ok") is not True
        or not entry.get("licence_note")
        or not _https_matches_domain(entry.get("url", ""), entry.get("candidate_domain", ""))
    ):
        raise SourceNotClearedError(f"SPEC_GAP: source {source_id} not cleared for ingestion")
    return entry
