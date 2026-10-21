-- Public read views. Row-level filtering is enforced by RLS policies in
-- 0003_access_model.sql; these views are column projections with
-- security_invoker = true. Column sets are spec-authoritative (A1, A3).
create view v_mps_public with (security_invoker = true) as
  select * from mps;

create view v_disclosures_public with (security_invoker = true) as
  select * from financial_disclosures;

create view v_spending_public with (security_invoker = true) as
  select * from state_spending_logs;

create view v_judicial_public with (security_invoker = true) as
  select * from judicial_proceedings
  where verification_status <> 'withdrawn';

create view v_flags_public with (security_invoker = true) as
  select * from review_flags
  where status = 'published';

create view v_sources_public with (security_invoker = true) as
  select id, source_id, publisher, title, url, tier, format, published_at,
         retrieved_at, sha256, licence_note
  from source_documents;

grant select on v_mps_public, v_disclosures_public, v_spending_public,
  v_judicial_public, v_flags_public, v_sources_public to anon, authenticated;
