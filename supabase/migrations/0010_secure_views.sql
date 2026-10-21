-- Drop the existing invoker views
drop view if exists v_disclosures_public;
drop view if exists v_spending_public;
drop view if exists v_judicial_public;

-- Recreate as definer views (security_invoker = false)
-- We explicitly include the RLS conditions inside the view logic because
-- definer views bypass RLS.

create view v_disclosures_public with (security_invoker = false) as
  select id, mp_id, category, description, counterparty, value_zar,
         period_start, period_end, source_document_id, verification_status,
         extracted_at
  from financial_disclosures
  where is_dormant = false
    and verification_status in ('machine_extracted', 'human_verified');

create view v_spending_public with (security_invoker = false) as
  select id, mp_id, spend_type, amount_zar, period_start, period_end, department,
         source_document_id, verification_status, extracted_at
  from state_spending_logs
  where is_dormant = false
    and verification_status in ('machine_extracted', 'human_verified');

create view v_judicial_public with (security_invoker = false) as
  select id, mp_id, status, case_number, court, summary_neutral, status_as_of,
         source_document_id, verification_status
  from judicial_proceedings
  where is_dormant = false
    and verification_status in ('machine_extracted', 'human_verified', 'disputed');

-- Grant select on the views to the public roles
grant select on v_disclosures_public to anon, authenticated;
grant select on v_spending_public to anon, authenticated;
grant select on v_judicial_public to anon, authenticated;
