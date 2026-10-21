grant select on
  mps, financial_disclosures, state_spending_logs, judicial_proceedings,
  review_flags, source_documents, disputes
to anon, authenticated;

create policy mps_public_read on mps
  for select to anon, authenticated using (true);

create policy disclosures_public_read on financial_disclosures
  for select to anon, authenticated
  using (verification_status in ('machine_extracted','human_verified'));

create policy spending_public_read on state_spending_logs
  for select to anon, authenticated
  using (verification_status in ('machine_extracted','human_verified'));

create policy judicial_public_read on judicial_proceedings
  for select to anon, authenticated
  using (verification_status in ('machine_extracted','human_verified','disputed'));

create policy flags_public_read on review_flags
  for select to anon, authenticated
  using (status = 'published');

create policy sources_public_read on source_documents
  for select to anon, authenticated using (true);

create policy disputes_public_read on disputes
  for select to anon, authenticated
  using (exists (
    select 1 from review_flags f
    where f.id = disputes.flag_id and f.status = 'published'
  ));

drop view if exists v_flags_public;

create view v_flags_public with (security_invoker = true) as
  select id, subject_type, subject_id, flag_type, rule_id, rule_version,
         computed_value, threshold, public_text, source_document_id,
         reviewed_at
  from review_flags
  where status = 'published';

grant select on v_flags_public to anon, authenticated;

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
