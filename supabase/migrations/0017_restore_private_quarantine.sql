-- Restore private quarantine for security
create schema if not exists private;

create table if not exists private.ingest_quarantine (
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

-- Keep existing quarantined rows (the public table holds a PMG parse failure
-- with its raw payload) before the public table is dropped.
insert into private.ingest_quarantine
select q.* from public.ingest_quarantine q
where not exists (select 1 from private.ingest_quarantine p where p.id = q.id);

drop table if exists public.ingest_quarantine;

-- Ensure service_role can write to it, but anon cannot
grant usage on schema private to service_role;
grant all privileges on table private.ingest_quarantine to service_role;
revoke all on private.ingest_quarantine from anon, authenticated;
revoke all on schema private from anon, authenticated;
