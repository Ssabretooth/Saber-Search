-- =============================================================================
-- Migration: profiles and auth trigger
-- Purpose:   Extend public.users into a user profile (name, surname, phone),
--            allow the auth provider 'email', and create the profile row
--            automatically whenever a user signs up (email or Google).
-- Affects:   public.users (columns, constraint, policies, grants),
--            public.handle_new_user() (new function),
--            auth.users trigger on_auth_user_created (new trigger).
-- Notes:     - Existing 'phone' provider rows are rewritten to 'email' before
--              the constraint is tightened.
--            - Users may update only first_name, last_name and phone. The role
--              column stays read-only for clients; admins change it via the
--              service role.
--            - No insert policy is granted to clients. Profile rows are created
--              only by the security definer trigger below.
-- =============================================================================

-- Rewrite the retired 'phone' provider so the tighter check constraint can be added.
update public.users
   set auth_provider = 'email'
 where auth_provider = 'phone';

-- DESTRUCTIVE: drops the existing auth_provider check constraint. It is replaced
-- immediately below with one that accepts 'email' instead of 'phone'.
alter table public.users drop constraint users_auth_provider_check;
alter table public.users add constraint users_auth_provider_check
  check (auth_provider in ('email', 'google', 'github'));

-- Profile fields. Nullable because users may sign up without them (e.g. Google)
-- and complete them later on the profile page.
alter table public.users
  add column first_name text,
  add column last_name text;

-- Column-level grant: authenticated users can change only their profile fields.
-- Table-level UPDATE is revoked first so role and auth_provider cannot be changed
-- by a client, which would otherwise allow self-promotion to admin.
revoke update on public.users from authenticated;
grant update (first_name, last_name, phone) on public.users to authenticated;

-- Authenticated users may update only their own row.
create policy "authenticated users can update own profile"
  on public.users
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Creates the matching public.users row for every new auth.users row.
-- Runs as the owner (security definer) so it bypasses RLS, which has no insert
-- policy for clients. search_path is pinned to prevent search-path hijacking.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, phone, first_name, last_name, auth_provider)
  values (
    new.id,
    new.email,
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone'),
    coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'given_name'),
    coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data ->> 'family_name'),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  );
  return new;
end;
$$;

-- Only the auth system should invoke the trigger function, not API roles.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
