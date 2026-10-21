drop table if exists private.ingest_quarantine;

create table private.ingest_quarantine (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  fetched_at timestamptz not null default now(),
  url text,
  http_status int,
  error_class text,
  error_detail text,
  raw_bytes_sha256 text,
  raw_payload bytea
);

alter table private.ingest_quarantine enable row level security;

revoke all on private.ingest_quarantine from anon, authenticated;
revoke all on schema private from anon, authenticated;
