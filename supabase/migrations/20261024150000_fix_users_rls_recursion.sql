-- =============================================================================
-- Migration: fix users RLS recursion
-- Purpose:   The admin policies on public.users from 0013 query public.users
--            inside a public.users policy, causing "infinite recursion detected"
--            for every authenticated read or update. This breaks profile loading
--            and profile saving. An is_admin() helper runs as the owner and
--            bypasses RLS, which breaks the cycle.
-- Affects:   public.is_admin() (new), public.users select and update policies.
-- Notes:     Also backfills first_name and last_name for existing rows where
--            they are still null, using the Google metadata fields.
-- =============================================================================

-- Returns true when the calling user has the admin role. Security definer means
-- the internal lookup bypasses RLS, so the policies below don't recurse.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Replace the recursive admin select policy with one that calls the helper.
drop policy "Admins can read all" on public.users;
create policy "admins can read all users"
  on public.users
  for select
  to authenticated
  using (public.is_admin());

-- Replace the recursive admin update policy with one that calls the helper.
drop policy "Admins can update" on public.users;
create policy "admins can update users"
  on public.users
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Backfill names for existing rows that signed up with Google before the
-- trigger read full_name. Only fills null values, never overwrites edits.
update public.users u
   set first_name = coalesce(u.first_name, split_part(a.raw_user_meta_data ->> 'full_name', ' ', 1)),
       last_name  = coalesce(u.last_name,  nullif(substring(a.raw_user_meta_data ->> 'full_name' from '\s(.+)$'), ''))
  from auth.users a
 where a.id = u.id
   and (u.first_name is null or u.last_name is null)
   and a.raw_user_meta_data ->> 'full_name' is not null;
