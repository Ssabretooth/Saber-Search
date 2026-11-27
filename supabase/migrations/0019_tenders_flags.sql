-- Allow procurement flags without a source document (they are computed matches, not parsed docs)
alter table public.review_flags alter column source_document_id drop not null;

-- Public view for procurement relationship flags
create or replace view public.v_procurement_flags_public
with (security_invoker = false) as
select
  rf.id,
  rf.public_text,
  rf.inputs->>'mp_name'                 as mp_name,
  rf.inputs->>'mp_party'                as mp_party,
  rf.inputs->>'tender_company'          as tender_company,
  rf.inputs->>'disclosure_counterparty' as disclosure_counterparty,
  rf.inputs->>'disclosure_category'     as disclosure_category,
  rf.inputs->>'tender_amount_zar'       as tender_amount_zar,
  rf.inputs->>'award_date'              as award_date,
  rf.inputs->>'department'              as department,
  rf.inputs->>'tender_title'            as tender_title,
  rf.inputs->>'match_reason'            as match_reason,
  rf.subject_id                         as mp_id
from public.review_flags rf
where rf.flag_type = 'procurement_relationship'
  and rf.subject_id is not null;

grant select on public.v_procurement_flags_public to anon, authenticated;
