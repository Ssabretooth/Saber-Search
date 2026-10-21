-- Allow the service_role (used by the ingestion pipeline) to write to the
-- private quarantine table. This does NOT expose it to anon/authenticated,
-- which remain completely revoked by 0004.

grant usage on schema private to service_role;
grant all privileges on table private.ingest_quarantine to service_role;
