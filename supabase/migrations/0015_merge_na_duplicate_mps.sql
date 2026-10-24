-- Consolidate National Assembly MP rows that were stored twice: once with
-- initials only ("Adams, Mr F") and once with full given names
-- ("Adams, Mr. Fadiel"), plus legacy rows with a party code left in the name
-- ("Botes, Mr A   ANC").
--
-- Match rule for an initials-only row (surname, title, first initial, chamber):
--   * surname equal (case-insensitive)
--   * title equal after normalising Doctor->Dr, Advocate->Adv and dropping dots
--   * first initial equal to the first letter of the full given name
--   * party equal when both rows carry one
-- One candidate: fold the row into it (child rows repointed, row removed).
-- Several candidates: left untouched for manual review.
-- No candidate: deprecated (removed), per the instruction to retire initials-only
-- rows. No such row has disclosure, spending or judicial records attached.
--
-- Every removed row is kept verbatim in public.mp_merge_log.

create table if not exists public.mp_merge_log (
  id uuid primary key default gen_random_uuid(),
  merged_at timestamptz not null default now(),
  action text not null check (action in ('merged', 'deprecated')),
  removed_mp_id uuid not null,
  kept_mp_id uuid references public.mps(id),
  removed_row jsonb not null
);

alter table public.mp_merge_log enable row level security;
revoke all on public.mp_merge_log from anon, authenticated;
grant all privileges on public.mp_merge_log to service_role;

create temp table na_initials_match on commit drop as
with parsed as (
  select
    id, full_name, party,
    lower(trim(split_part(full_name, ',', 1))) as surname,
    trim(regexp_replace(split_part(full_name, ',', 2), '\s{2,}.*$', '')) as rest
  from public.mps
  where chamber = 'na'
), titled as (
  select
    *,
    regexp_replace(
      lower(split_part(rest, ' ', 1)), '\.$', ''
    ) as t0,
    regexp_replace(
      rest, '^(Mr|Ms|Mrs|Dr|Doctor|Adv|Advocate|Prof|Rev|Inkosi|Prince|Chief|Hon)\.?\s+', '', 'i'
    ) as given
  from parsed
), tagged as (
  select
    *,
    case t0 when 'doctor' then 'dr' when 'advocate' then 'adv' else t0 end as title,
    (given ~ '^[A-Z]{1,4}(\s+[A-Z])?$') as initials_only,
    left(given, 1) as first_letter
  from titled
), candidates as (
  select
    i.id as removed_id,
    f.id as kept_id
  from tagged i
  join tagged f
    on not f.initials_only
   and f.surname = i.surname
   and f.title = i.title
   and upper(f.first_letter) = upper(i.first_letter)
   and (f.party is null or i.party is null or f.party = i.party)
  where i.initials_only
)
select
  i.id as removed_id,
  count(c.kept_id) as cands,
  min(c.kept_id::text)::uuid as kept_id
from tagged i
left join candidates c on c.removed_id = i.id
where i.initials_only
group by i.id;

-- 1. Fold uniquely matched initials rows into their full-name row.
insert into public.mp_merge_log (action, removed_mp_id, kept_mp_id, removed_row)
select 'merged', m.removed_id, m.kept_id, to_jsonb(p)
from na_initials_match m
join public.mps p on p.id = m.removed_id
where m.cands = 1;

update public.financial_disclosures d
set mp_id = m.kept_id
from na_initials_match m
where d.mp_id = m.removed_id and m.cands = 1;

update public.state_spending_logs d
set mp_id = m.kept_id
from na_initials_match m
where d.mp_id = m.removed_id and m.cands = 1;

update public.judicial_proceedings d
set mp_id = m.kept_id
from na_initials_match m
where d.mp_id = m.removed_id and m.cands = 1;

delete from public.mps p
using na_initials_match m
where p.id = m.removed_id and m.cands = 1;

-- 2. Deprecate initials-only rows with no full-name counterpart.
insert into public.mp_merge_log (action, removed_mp_id, kept_mp_id, removed_row)
select 'deprecated', m.removed_id, null, to_jsonb(p)
from na_initials_match m
join public.mps p on p.id = m.removed_id
where m.cands = 0;

delete from public.mps p
using na_initials_match m
where p.id = m.removed_id and m.cands = 0;

-- 3. Move party codes that leaked into names onto the party column,
--    then strip them from the name and collapse doubled spaces.
update public.mps
set party = substring(full_name from '\s+(ANC|DA|EFF|IFP|MKP|UDM|ACDP|FF|PAC|COPE|ATM|NFP|UAT|AIC|VF)$')
where chamber = 'na'
  and party is null
  and full_name ~ '\s+(ANC|DA|EFF|IFP|MKP|UDM|ACDP|FF|PAC|COPE|ATM|NFP|UAT|AIC|VF)$';

update public.mps
set full_name = regexp_replace(
  regexp_replace(full_name, '\s+(ANC|DA|EFF|IFP|MKP|UDM|ACDP|FF|PAC|COPE|ATM|NFP|UAT|AIC|VF)$', ''),
  '\s{2,}', ' ', 'g'
)
where chamber = 'na'
  and full_name ~ '(\s{2,}|\s+(ANC|DA|EFF|IFP|MKP|UDM|ACDP|FF|PAC|COPE|ATM|NFP|UAT|AIC|VF)$)';
