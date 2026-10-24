create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  auth_provider text not null check (auth_provider in ('github', 'google', 'phone')),
  role text not null check (role in ('admin', 'user')) default 'user',
  created_at timestamptz not null default now()
);

create unique index idx_users_email on users(email) where email is not null;
create unique index idx_users_phone on users(phone) where phone is not null;

alter table public.users enable row level security;

create policy "Users can read own data" on users for select using (auth.uid() = id);
create policy "Admins can read all" on users for select using (
  (select role from users where id = auth.uid()) = 'admin'
);
create policy "Admins can update" on users for update using (
  (select role from users where id = auth.uid()) = 'admin'
);
