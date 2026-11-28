"""
Failproof bootstrap: run every cleared source in dependency order.

Each source is fully isolated — a failure in one never aborts the rest.
Transient errors (network, 429, 5xx) are retried with exponential backoff.
A clean summary is printed at the end; exit code is 0 unless EVERY source failed.

Usage:
    python -m ingestion.bootstrap                   # all sources
    python -m ingestion.bootstrap --only parliament_register_interests pmg_na_members
    python -m ingestion.bootstrap --skip jhb_councillors
    python -m ingestion.bootstrap --dry-run         # validate lock file, print plan, quit
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import NamedTuple

from dotenv import load_dotenv

from .config import load_cleared_sources
from .errors import ParserSpecGap, PublikEyeError, SourceGateError, SourceNotClearedError
from .run import run as _run_one

load_dotenv()

log = logging.getLogger("publikeye.bootstrap")

# ── dependency order ──────────────────────────────────────────────────────────
# Sources that must succeed before later ones are useful, listed first.
# Any source not in this list runs after all ordered sources, alphabetically.
ORDERED = [
    "treasury_municipalities",    # municipality master data
    "electai_wards",              # 2026 ward councillors + municipality enrichment
    "parliament_na_members",      # official NA member list (name authority)
    "pmg_na_members",             # secondary NA list (broader coverage)
    "nationalgov_ncop_members",   # NCOP delegates
    "jhb_councillors",            # JHB metro PDF councillors
    "pa_pombola",                 # People's Assembly profile enrichment
    "parliament_register_interests",  # financial disclosures (needs MPs in DB)
    "parliament_travel_claims",   # travel spending
    "saflii_judgments",           # judicial proceedings
]

# Sources with this prefix run in alphabetical order after the above
ETENDERS_PREFIX = "treasury_etenders_"

# ── result types ─────────────────────────────────────────────────────────────

class Status(str, Enum):
    OK        = "OK"
    SKIP      = "SKIP"
    TRANSIENT = "TRANSIENT"   # network / 429 / 5xx — retriable
    SPEC_GAP  = "SPEC_GAP"    # parser layout changed — human fix needed
    CONFIG    = "CONFIG"      # env var missing or lock file broken
    ERROR     = "ERROR"       # unexpected DB or logic error


@dataclass
class SourceResult:
    source_id: str
    status: Status
    attempts: int = 1
    duration_s: float = 0.0
    detail: str = ""


# ── exit-code mapping ─────────────────────────────────────────────────────────
# run() return values (from run.py):
#   0  success
#   1  missing env
#   2  source not cleared
#   3  no parser
#   4  fetch/gate failed (transient)
#   5  parse failed (spec gap)
#   6  unexpected error

def _classify_exit(code: int) -> Status:
    if code == 0:
        return Status.OK
    if code == 4:
        return Status.TRANSIENT
    if code in (5,):
        return Status.SPEC_GAP
    if code in (1, 2, 3):
        return Status.CONFIG
    return Status.ERROR


# ── single-source runner with retry ──────────────────────────────────────────

_MAX_RETRIES = 3
_RETRY_BACKOFF = (5, 15, 45)   # seconds between attempts


def _run_with_retry(source_id: str) -> SourceResult:
    t0 = time.monotonic()
    attempts = 0

    for attempt in range(_MAX_RETRIES):
        attempts += 1
        try:
            code = _run_one(source_id)
        except SystemExit as e:
            code = int(e.code or 1)
        except Exception as exc:
            log.exception("unexpected exception running %s", source_id)
            code = 6
            if attempt < _MAX_RETRIES - 1:
                wait = _RETRY_BACKOFF[attempt]
                log.warning("  → will retry in %ds (attempt %d/%d)", wait, attempt + 1, _MAX_RETRIES)
                time.sleep(wait)
            continue

        status = _classify_exit(code)

        if status == Status.OK:
            return SourceResult(source_id, Status.OK, attempts, time.monotonic() - t0)

        if status == Status.TRANSIENT and attempt < _MAX_RETRIES - 1:
            wait = _RETRY_BACKOFF[attempt]
            log.warning(
                "%s: transient failure (exit %d) — retrying in %ds (attempt %d/%d)",
                source_id, code, wait, attempt + 1, _MAX_RETRIES,
            )
            time.sleep(wait)
            continue

        # Non-transient or exhausted retries
        return SourceResult(
            source_id, status, attempts, time.monotonic() - t0,
            detail=f"exit {code}",
        )

    # Exhausted all retries on transient
    return SourceResult(
        source_id, Status.TRANSIENT, attempts, time.monotonic() - t0,
        detail=f"failed after {attempts} attempts",
    )


# ── orchestrator ──────────────────────────────────────────────────────────────

def _build_run_order(all_ids: list[str]) -> list[str]:
    ordered = [s for s in ORDERED if s in all_ids]
    etenders = sorted(s for s in all_ids if s.startswith(ETENDERS_PREFIX))
    rest = sorted(s for s in all_ids if s not in ordered and s not in etenders)
    return ordered + rest + etenders


def bootstrap(
    *,
    only: list[str] | None = None,
    skip: list[str] | None = None,
    dry_run: bool = False,
) -> int:
    # Load and validate lock file
    try:
        cleared = load_cleared_sources()
    except SourceNotClearedError as e:
        log.error("cannot load lock file: %s", e)
        return 1

    all_ids = list(cleared.keys())
    run_order = _build_run_order(all_ids)

    if only:
        unknown = [s for s in only if s not in cleared]
        if unknown:
            log.error("unknown source IDs: %s", ", ".join(unknown))
            return 1
        run_order = [s for s in run_order if s in only]

    if skip:
        run_order = [s for s in run_order if s not in skip]

    if dry_run:
        print(f"\n{'─'*60}")
        print(f"  DRY RUN — {len(run_order)} sources would run:\n")
        for i, sid in enumerate(run_order, 1):
            src = cleared[sid]
            print(f"  {i:>2}. {sid:<40}  [{src.tier}]")
        print(f"\n{'─'*60}\n")
        return 0

    log.info("bootstrap: %d sources to ingest", len(run_order))

    results: list[SourceResult] = []
    t_start = time.monotonic()

    for sid in run_order:
        log.info("── %s ──────────────────────────────────", sid)
        result = _run_with_retry(sid)
        results.append(result)
        icon = "✓" if result.status == Status.OK else "✗"
        log.info(
            "%s %s  [%s]  %.1fs  %s",
            icon, sid, result.status.value,
            result.duration_s, result.detail or "",
        )

    total_s = time.monotonic() - t_start
    _print_summary(results, total_s)

    n_ok = sum(1 for r in results if r.status == Status.OK)
    n_fail = len(results) - n_ok
    if n_fail and n_ok == 0:
        return 1   # everything failed
    if n_fail:
        return 2   # partial success
    return 0       # all good


def _print_summary(results: list[SourceResult], total_s: float) -> None:
    n_ok        = sum(1 for r in results if r.status == Status.OK)
    n_transient = sum(1 for r in results if r.status == Status.TRANSIENT)
    n_spec      = sum(1 for r in results if r.status == Status.SPEC_GAP)
    n_config    = sum(1 for r in results if r.status == Status.CONFIG)
    n_error     = sum(1 for r in results if r.status == Status.ERROR)
    n_skip      = sum(1 for r in results if r.status == Status.SKIP)

    COL = {
        Status.OK:        "\033[32m",   # green
        Status.TRANSIENT: "\033[33m",   # yellow
        Status.SPEC_GAP:  "\033[35m",   # magenta
        Status.CONFIG:    "\033[31m",   # red
        Status.ERROR:     "\033[31m",   # red
        Status.SKIP:      "\033[90m",   # grey
    }
    RESET = "\033[0m"

    print(f"\n{'━'*72}")
    print(f"  BOOTSTRAP SUMMARY   {len(results)} sources   {total_s:.0f}s elapsed\n")
    print(f"  {'SOURCE':<40}  {'STATUS':<10}  {'ATTEMPTS':>8}  {'TIME':>7}")
    print(f"  {'─'*40}  {'─'*10}  {'─'*8}  {'─'*7}")

    for r in results:
        color = COL.get(r.status, "")
        flag = "!" if r.detail else " "
        print(
            f"  {r.source_id:<40}  "
            f"{color}{r.status.value:<10}{RESET}  "
            f"{'×' + str(r.attempts):>8}  "
            f"{r.duration_s:>6.1f}s"
            + (f"  ← {r.detail}" if r.detail else "")
        )

    print(f"\n  {'─'*68}")
    summary_parts = [f"\033[32m{n_ok} OK\033[0m"]
    if n_transient: summary_parts.append(f"\033[33m{n_transient} transient\033[0m")
    if n_spec:      summary_parts.append(f"\033[35m{n_spec} spec-gap\033[0m")
    if n_config:    summary_parts.append(f"\033[31m{n_config} config\033[0m")
    if n_error:     summary_parts.append(f"\033[31m{n_error} error\033[0m")
    if n_skip:      summary_parts.append(f"\033[90m{n_skip} skipped\033[0m")
    print(f"  {'  ·  '.join(summary_parts)}")
    print(f"{'━'*72}\n")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-7s  %(name)s  %(message)s",
        datefmt="%H:%M:%S",
    )
    # Quieten supabase/httpx noise
    for noisy in ("httpx", "httpcore", "supabase", "postgrest"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    ap = argparse.ArgumentParser(
        prog="python -m ingestion.bootstrap",
        description="Failproof ingestion bootstrap — runs all cleared sources.",
    )
    ap.add_argument(
        "--only", nargs="+", metavar="SOURCE_ID",
        help="Run only these source IDs (space-separated).",
    )
    ap.add_argument(
        "--skip", nargs="+", metavar="SOURCE_ID",
        help="Skip these source IDs.",
    )
    ap.add_argument(
        "--dry-run", action="store_true",
        help="Print the run plan and exit without touching the DB.",
    )
    args = ap.parse_args(argv)

    return bootstrap(only=args.only, skip=args.skip, dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
