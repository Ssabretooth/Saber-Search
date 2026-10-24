update public.users set auth_provider = 'email' where auth_provider = 'phone';

alter table public.users drop constraint users_auth_provider_check;
alter table public.users add constraint users_auth_provider_check
  check (auth_provider in ('email', 'google', 'github'));

alter table public.users
  add column first_name text,
  add column last_name text;

create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

revoke update on public.users from authenticated;
grant update (first_name, last_name, phone) on public.users to authenticated;

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
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    coalesce(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'given_name'),
    coalesce(new.raw_user_meta_data->>'last_name', new.raw_user_meta_data->>'family_name'),
    coalesce(new.raw_app_meta_data->>'provider', 'email')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
