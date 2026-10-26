create table public.municipalities (
  id uuid primary key default gen_random_uuid(),
  demarcation_code text not null unique,
  name text not null,
  long_name text,
  province text,
  category text,
  population integer,
  url text,
  created_at timestamptz not null default now()
);

alter table public.municipalities enable row level security;
revoke all on public.municipalities from anon, authenticated;

create view public.v_municipalities_public with (security_invoker = false) as
  select id, demarcation_code, name, long_name, province, category, population, url
  from public.municipalities;

grant select on public.v_municipalities_public to anon, authenticated;
