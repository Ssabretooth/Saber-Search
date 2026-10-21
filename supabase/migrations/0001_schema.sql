create type source_tier as enum (
  'tier1_official','tier2_judgment','tier2_indexed_republication','tier3_media'
);
create type verification_status as enum
  ('machine_extracted','human_verified','disputed','withdrawn');
create type review_status as enum ('draft','in_review','published','rejected');
create type disclosure_category as enum
  ('directorship','paid_employment','shareholding','consultancy',
   'gift_hospitality','foreign_travel','land_property','other');
create type spend_type as enum
  ('domestic_travel','international_travel','constituency_allowance','other');
create type flag_type as enum
  ('outlier_expense','disclosure_inconsistency','cipc_directorship_match',
   'procurement_relationship','civil_proceeding',
   'criminal_charge_pending','acquitted','convicted_appeal_pending',
   'convicted_final');
create type judicial_status as enum
  ('charge_pending','acquitted','convicted_appeal_pending','convicted_final',
   'civil_matter');

create table source_documents (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  publisher text not null, title text not null, url text not null,
  tier source_tier not null, format text not null,
  published_at date, retrieved_at timestamptz not null default now(),
  sha256 text not null, licence_note text, local_path text
);

create table mps (
  id uuid primary key default gen_random_uuid(),
  full_name text not null, known_as text,
  chamber text not null check (chamber in ('na','ncop')),
  party text, constituency text, portfolio text,
  term_start date, term_end date, official_profile_url text
);

create table financial_disclosures (
  id uuid primary key default gen_random_uuid(),
  mp_id uuid not null references mps(id),
  category disclosure_category not null,
  description text, counterparty text, value_zar numeric(14,2),
  period_start date, period_end date,
  source_document_id uuid not null references source_documents(id),
  verification_status verification_status not null default 'machine_extracted',
  parser_version text not null, extracted_at timestamptz not null default now()
);

create table state_spending_logs (
  id uuid primary key default gen_random_uuid(),
  mp_id uuid not null references mps(id),
  spend_type spend_type not null, amount_zar numeric(14,2) not null,
  period_start date not null, period_end date not null,
  department text,
  source_document_id uuid not null references source_documents(id),
  verification_status verification_status not null default 'machine_extracted',
  parser_version text not null, extracted_at timestamptz not null default now()
);

create table judicial_proceedings (
  id uuid primary key default gen_random_uuid(),
  mp_id uuid not null references mps(id),
  status judicial_status not null, case_number text,
  court text, summary_neutral text, status_as_of date not null,
  source_document_id uuid not null references source_documents(id),
  verification_status verification_status not null default 'human_verified'
);

create table review_flags (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null, subject_id uuid not null,
  flag_type flag_type not null,
  rule_id text not null, rule_version text not null,
  inputs jsonb not null, computed_value numeric, threshold numeric,
  public_text text not null, status review_status not null default 'draft',
  reviewer_id uuid, reviewed_at timestamptz,
  source_document_id uuid not null references source_documents(id)
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  flag_id uuid references review_flags(id),
  submitted_by text not null, statement text not null,
  resolution text, resolved_at timestamptz
);

create schema if not exists private;

create table private.ingest_quarantine (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  payload jsonb not null,
  error text not null,
  quarantined_at timestamptz not null default now()
);

alter table source_documents enable row level security;
alter table mps enable row level security;
alter table financial_disclosures enable row level security;
alter table state_spending_logs enable row level security;
alter table judicial_proceedings enable row level security;
alter table review_flags enable row level security;
alter table disputes enable row level security;
alter table private.ingest_quarantine enable row level security;
