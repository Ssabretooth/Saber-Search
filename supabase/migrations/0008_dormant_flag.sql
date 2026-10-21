alter table financial_disclosures add column is_dormant boolean not null default false;
alter table state_spending_logs add column is_dormant boolean not null default false;
alter table judicial_proceedings add column is_dormant boolean not null default false;

drop view if exists v_disclosures_public;
create view v_disclosures_public with (security_invoker = true) as
  select id, mp_id, category, description, counterparty, value_zar,
         period_start, period_end, source_document_id, verification_status,
         extracted_at
  from financial_disclosures where is_dormant = false;

drop view if exists v_spending_public;
create view v_spending_public with (security_invoker = true) as
  select id, mp_id, spend_type, amount_zar, period_start, period_end, department,
         source_document_id, verification_status, extracted_at
  from state_spending_logs where is_dormant = false;

drop view if exists v_judicial_public;
create view v_judicial_public with (security_invoker = true) as
  select id, mp_id, status, case_number, court, summary_neutral, status_as_of,
         source_document_id, verification_status
  from judicial_proceedings
  where verification_status <> 'withdrawn' and is_dormant = false;

grant select on v_disclosures_public to anon, authenticated;
grant select on v_spending_public to anon, authenticated;
grant select on v_judicial_public to anon, authenticated;
