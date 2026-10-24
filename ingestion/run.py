import argparse
import collections
import hashlib
import logging
import os
import sys

from dotenv import load_dotenv

from .config import get_source
from .errors import (
    ParserSpecGap, PublikEyeError, QuarantineError,
    SourceGateError, SourceNotClearedError,
)
from .http_client import fetch
from .parsers.base import BaseParser, sha256_hex
from .parsers.parliament_register_interests import (
    ParliamentRegisterInterestsParser,
)
from .parsers.parliament_travel_claims import ParliamentTravelClaimsParser
from .parsers.parliament_na_members import ParliamentNaMembersParser
from .parsers.nationalgov_ncop_members import NationalGovNcopMembersParser
from .parsers.saflii_judgments import SafliiJudgmentsParser
from .writer import SupabaseWriter

load_dotenv()
log = logging.getLogger("publikeye.ingestion")

PARSERS: dict[str, type[BaseParser]] = {
    ParliamentRegisterInterestsParser.source_id: ParliamentRegisterInterestsParser,
    ParliamentTravelClaimsParser.source_id: ParliamentTravelClaimsParser,
    SafliiJudgmentsParser.source_id: SafliiJudgmentsParser,
    ParliamentNaMembersParser.source_id: ParliamentNaMembersParser,
    NationalGovNcopMembersParser.source_id: NationalGovNcopMembersParser,
}


def _row_hash(*parts) -> str:
    raw = "|".join("" if p is None else str(p) for p in parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _flatten_mps(doc):
    return [m.model_dump(mode="json") for m in doc.mps]


def _flatten_disclosures(doc, source_doc_id, parser_version, mps_by_name):
    out = []
    seen = collections.Counter()
    for d in doc.disclosures:
        mp_id = mps_by_name.get(d.mp_full_name.strip().lower())
        if mp_id is None:
            raise ParserSpecGap(
                f"unknown MP: {d.mp_full_name!r}"
            )
        base = _row_hash(
            mp_id, d.category, d.description, d.counterparty,
            d.value_zar, d.period_start, d.period_end,
        )
        occurrence = seen[base]
        seen[base] += 1
        out.append({
            "row_hash": _row_hash(base, occurrence),
            "mp_id": mp_id,
            "category": d.category,
            "description": d.description,
            "counterparty": d.counterparty,
            "value_zar": (
                str(d.value_zar) if d.value_zar is not None else None
            ),
            "period_start": (
                d.period_start.isoformat()
                if d.period_start is not None else None
            ),
            "period_end": (
                d.period_end.isoformat()
                if d.period_end is not None else None
            ),
            "source_document_id": source_doc_id,
            "verification_status": "machine_extracted",
            "parser_version": parser_version,
            "is_dormant": occurrence > 0,
        })
    return out


def _flatten_spending(doc, source_doc_id, parser_version, mps_by_name):
    out = []
    for s in doc.spending:
        mp_id = mps_by_name.get(s.mp_full_name.strip().lower())
        if mp_id is None:
            raise ParserSpecGap(
                f"unknown MP: {s.mp_full_name!r}"
            )
        out.append({
            "row_hash": _row_hash(
                mp_id, s.spend_type, s.amount_zar, s.period_start,
                s.period_end, s.department,
            ),
            "mp_id": mp_id,
            "spend_type": s.spend_type,
            "amount_zar": str(s.amount_zar),
            "period_start": s.period_start.isoformat(),
            "period_end": s.period_end.isoformat(),
            "department": s.department,
            "source_document_id": source_doc_id,
            "verification_status": "machine_extracted",
            "parser_version": parser_version,
        })
    return out


def _flatten_judicial(doc, source_doc_id, parser_version, mps_by_name):
    out = []
    for j in doc.judicial:
        mp_id = mps_by_name.get(j.mp_full_name.strip().lower())
        if mp_id is None:
            raise ParserSpecGap(
                f"unknown MP: {j.mp_full_name!r}"
            )
        out.append({
            "row_hash": _row_hash(
                mp_id, j.status, j.case_number, j.court,
                j.summary_neutral, j.status_as_of,
            ),
            "mp_id": mp_id,
            "status": j.status,
            "case_number": j.case_number,
            "court": j.court,
            "summary_neutral": j.summary_neutral,
            "status_as_of": j.status_as_of.isoformat(),
            "source_document_id": source_doc_id,
            "verification_status": "human_verified",
        })
    return out


def run(source_id: str) -> int:
    log.info("starting ingestion for %s", source_id)

    # 1. Gate FIRST — no network, no writer before this.
    try:
        source = get_source(source_id)
    except SourceNotClearedError as e:
        log.error("GATE: %s", e)
        return 2

    # 2. Parser lookup.
    if source_id not in PARSERS:
        log.error("SPEC_GAP: no parser for %r", source_id)
        return 3
    parser = PARSERS[source_id]()

    # 3. Writer construction.
    try:
        writer = SupabaseWriter(
            url=os.environ["SUPABASE_URL"],
            service_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    except KeyError as e:
        log.error("missing env var: %s", e)
        return 1

    # 4. Fetch.
    try:
        fetched = fetch(source)
    except SourceGateError as e:
        log.error("FETCH: %s", e)
        try:
            writer.quarantine(
                source=source, http_status=None,
                error_class="SourceGateError", error_detail=str(e),
                raw_sha256="", raw_payload=b"",
            )
        except QuarantineError as qe:
            log.error("quarantine also failed: %s", qe)
        return 4

    raw_sha = sha256_hex(fetched.content)

    # 5. Parse.
    try:
        doc = parser.parse(
            content=fetched.content,
            content_type=fetched.content_type,
            fetched_url=fetched.url,
        )
    except ParserSpecGap as e:
        log.error("SPEC_GAP: %s", e)
        try:
            writer.quarantine(
                source=source, http_status=fetched.status,
                error_class="ParserSpecGap", error_detail=str(e),
                raw_sha256=raw_sha, raw_payload=fetched.content,
            )
        except QuarantineError as qe:
            log.error("quarantine also failed: %s", qe)
        return 5
    except Exception as e:
        log.exception("parse failed")
        try:
            writer.quarantine(
                source=source, http_status=fetched.status,
                error_class=type(e).__name__, error_detail=str(e),
                raw_sha256=raw_sha, raw_payload=fetched.content,
            )
        except QuarantineError as qe:
            log.error("quarantine also failed: %s", qe)
        return 5

    # 6. Source document row FIRST.
    source_doc_id = writer.register_source_document(
        source=source, content=fetched.content,
        sha256_hex=raw_sha, fetched_url=fetched.url,
    )

    # 7. MP upsert.
    if doc.mps:
        writer.upsert_facts(
            table="mps", rows=_flatten_mps(doc),
            conflict_cols="full_name,chamber,term_start",
        )

    # 8. Re-query mps from DB — do NOT trust doc.mps order.
    mps_by_name = writer.get_mps_by_name()

    # 9a. Flatten all three lists FIRST — unknown MP raises before any write.
    try:
        disc_rows = _flatten_disclosures(
            doc, source_doc_id, parser.parser_version, mps_by_name,
        )
        spend_rows = _flatten_spending(
            doc, source_doc_id, parser.parser_version, mps_by_name,
        )
        jud_rows = _flatten_judicial(
            doc, source_doc_id, parser.parser_version, mps_by_name,
        )
    except ParserSpecGap as e:
        log.error("SPEC_GAP during flatten: %s", e)
        try:
            writer.quarantine(
                source=source, http_status=fetched.status,
                error_class="ParserSpecGap", error_detail=str(e),
                raw_sha256=raw_sha, raw_payload=fetched.content,
            )
        except QuarantineError as qe:
            log.error("quarantine also failed: %s", qe)
        return 5

    # 9b. All flatten succeeded — now write all three fact tables.
    n_disc = writer.upsert_facts(
        table="financial_disclosures", rows=disc_rows,
        conflict_cols="source_document_id,row_hash",
    )
    n_spend = writer.upsert_facts(
        table="state_spending_logs", rows=spend_rows,
        conflict_cols="source_document_id,row_hash",
    )
    n_jud = writer.upsert_facts(
        table="judicial_proceedings", rows=jud_rows,
        conflict_cols="source_document_id,row_hash",
    )

    log.info(
        "done: source_doc=%s mps=%d disclosures=%d spending=%d judicial=%d",
        source_doc_id, len(doc.mps), n_disc, n_spend, n_jud,
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s %(name)s %(message)s",
    )
    ap = argparse.ArgumentParser(prog="python -m ingestion.run")
    ap.add_argument("source_id", help="id from config/sources.lock.yaml")
    args = ap.parse_args(argv)
    try:
        return run(args.source_id)
    except PublikEyeError as e:
        log.error("%s: %s", type(e).__name__, e)
        return 1
    except Exception as e:
        log.error("DB or unexpected error: %s", e)
        return 6


if __name__ == "__main__":
    sys.exit(main())
