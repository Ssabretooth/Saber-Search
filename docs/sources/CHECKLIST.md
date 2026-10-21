# Source verification checklist (human verifier)

1. Open `candidate_domain` in a browser. Confirm the publisher matches.
2. Find the exact document landing page for the current term or report.
3. Confirm the page is served over HTTPS and the link is stable (not session- or hash-scoped).
4. Read `robots.txt` and the site's ToS. Record `licence_note` with the clause.
5. Fetch the document once. Record `first_fetch_sha256`.
6. In `config/sources.yaml`, fill `url`, `format`, `licence_note`, `robots_ok`, `verified_by`, `verified_at`, and set `verified: true`.
7. Copy the cleared entry into `config/sources.lock.yaml`.
8. Save a screenshot of the landing page to `docs/sources/evidence/<id>.png`.

Ingestion re-checks `robots.txt` on every run, so `robots_ok` is a snapshot, not a guarantee.
