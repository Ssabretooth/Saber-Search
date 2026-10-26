create table public.tenders (
  id uuid primary key default gen_random_uuid(),
  ocid text not null unique,
  title text not null,
  department text,
  winning_company text not null,
  amount_zar numeric(14,2),
  award_date date,
  source_document_id uuid references public.source_documents(id),
  created_at timestamptz not null default now()
);

-- Add a unique index to prevent duplicate flags for the same MP + tender
create unique index review_flags_procurement_uniq
on public.review_flags (subject_id, (inputs->>'tender_id'))
where flag_type = 'procurement_relationship';

-- Enable RLS and lock down the base table (Pattern from 0010/0011)
alter table public.tenders enable row level security;

revoke all on public.tenders from anon, authenticated;

-- Create the public view (run as owner to bypass RLS safely)
create view public.v_tenders_public with (security_invoker = false) as
  select id, ocid, title, department, winning_company, amount_zar, award_date, created_at
  from public.tenders;

grant select on public.v_tenders_public to anon, authenticated;
