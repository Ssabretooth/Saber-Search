from typing import cast

from supabase import Client, create_client

from .config import ClearedSource
from .errors import PublikEyeError, QuarantineError

CHUNK_SIZE = 500


class SupabaseWriter:
    def __init__(self, url: str, service_key: str):
        self.client: Client = create_client(url, service_key)

    def register_source_document(
        self, *, source: ClearedSource, content: bytes,
        sha256_hex: str, fetched_url: str,
    ) -> str:
        payload = {
            "source_id": source.id,
            "publisher": source.publisher,
            "title": source.title,
            "url": fetched_url,
            "tier": source.tier,
            "format": source.format,
            "sha256": sha256_hex,
            "licence_note": source.licence_note,
        }
        res = (
            self.client.table("source_documents")
            .upsert(payload, on_conflict="source_id,sha256")
            .execute()
        )
        if not res.data:
            raise PublikEyeError(
                "source_documents upsert returned no rows"
            )
        return cast(dict[str, str], res.data[0])["id"]

    def upsert_facts(
        self, *, table: str, rows: list[dict], conflict_cols: str,
    ) -> int:
        if not rows:
            return 0
        total = 0
        for i in range(0, len(rows), CHUNK_SIZE):
            chunk = rows[i : i + CHUNK_SIZE]
            res = (
                self.client.table(table)
                .upsert(chunk, on_conflict=conflict_cols, ignore_duplicates=True)
                .execute()
            )
            total += len(res.data or [])
        return total

    def quarantine(
        self, *, source: ClearedSource, http_status: int | None,
        error_class: str, error_detail: str,
        raw_sha256: str, raw_payload: bytes,
    ) -> None:
        try:
            self.client.schema("private").table("ingest_quarantine").insert(
                {
                    "source_id": source.id,
                    "url": source.url,
                    "http_status": http_status,
                    "error_class": error_class,
                    "error_detail": error_detail[:4000],
                    "raw_bytes_sha256": raw_sha256,
                    "raw_payload": "\\x" + raw_payload.hex(),
                }
            ).execute()
        except Exception as e:
            raise QuarantineError(
                f"quarantine write failed: {e}"
            ) from e

    def get_mps_by_name(self) -> dict[str, str]:
        """Return full_name.lower() → id for every MP.

        When two rows share the same lowercased name (e.g. a canonical entry
        with term_start plus a null-stub created by the register parser), we
        prefer the row that has term_start set — it carries richer data.
        A warning is logged but no exception is raised.
        """
        import logging as _log
        # Fetch id, full_name, term_start so we can resolve ties.
        rows: list[dict] = []
        PAGE = 1000
        offset = 0
        while True:
            res = (
                self.client.table("mps")
                .select("id, full_name, term_start")
                .range(offset, offset + PAGE - 1)
                .execute()
            )
            batch = res.data or []
            rows.extend(batch)
            if len(batch) < PAGE:
                break
            offset += PAGE

        by_name: dict[str, str] = {}
        for r in rows:
            key = r["full_name"].strip().lower()
            if key in by_name:
                # Keep the entry with term_start (canonical); discard the stub.
                existing_has_term = r.get("term_start") is None  # existing wins if it has term
                if r.get("term_start") is not None:
                    by_name[key] = r["id"]  # incoming has term_start → replace stub
                _log.getLogger(__name__).debug("duplicate MP name resolved: %r", key)
            else:
                by_name[key] = r["id"]
        return by_name
