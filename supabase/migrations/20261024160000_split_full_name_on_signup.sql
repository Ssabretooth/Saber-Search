-- =============================================================================
-- Migration: split full_name on signup
-- Purpose:   Google and other OAuth providers may supply only full_name, not
--            given_name and family_name. Fall back to splitting full_name so
--            new profiles get a first and last name.
-- Affects:   public.handle_new_user() (replaced in place).
-- Notes:     - Precedence: first_name / last_name (email signup), then
--              given_name / family_name (OAuth), then full_name.
--            - Single-word names fill first_name only; last_name stays null.
--            - Null and blank values are ignored via nullif(btrim(...), '').
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := new.raw_user_meta_data;
  full_name text := nullif(btrim(meta ->> 'full_name'), '');
  space_at int := position(' ' in coalesce(full_name, ''));
begin
  insert into public.users (id, email, phone, first_name, last_name, auth_provider)
  values (
    new.id,
    new.email,
    coalesce(new.phone, nullif(btrim(meta ->> 'phone'), '')),
    coalesce(
      nullif(btrim(meta ->> 'first_name'), ''),
      nullif(btrim(meta ->> 'given_name'), ''),
      case when full_name is not null then split_part(full_name, ' ', 1) end
    ),
    coalesce(
      nullif(btrim(meta ->> 'last_name'), ''),
      nullif(btrim(meta ->> 'family_name'), ''),
      case when space_at > 0 then nullif(btrim(substring(full_name from space_at + 1)), '') end
    ),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  );
  return new;
end;
$$;
