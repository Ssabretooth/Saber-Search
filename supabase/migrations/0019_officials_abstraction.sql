-- 1. Relax the chamber constraint
alter table public.mps drop constraint if exists mps_chamber_check;
alter table public.mps add constraint mps_chamber_check check (chamber in ('na', 'ncop', 'local'));

-- 2. Add government_level to the mps table
alter table public.mps add column government_level text default 'national' not null;
alter table public.mps add constraint valid_gov_level check (government_level in ('national', 'provincial', 'local'));

-- 3. Recreate the public view to include this column
drop view if exists public.v_mps_public;
create view public.v_mps_public with (security_invoker = false) as
  select id, full_name, known_as, chamber, party, constituency, portfolio,
         government_level, term_start, term_end, official_profile_url
  from public.mps;

grant select on public.v_mps_public to anon, authenticated;
