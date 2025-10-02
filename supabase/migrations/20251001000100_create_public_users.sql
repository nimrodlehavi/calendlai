-- Create public users profile table referencing auth.users
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  username text unique,
  display_name text,
  bio text,
  created_at timestamptz default now()
);

alter table public.users enable row level security;

-- Policies: user can manage own row
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_select_self'
  ) then
    create policy users_select_self on public.users for select using (id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_insert_self'
  ) then
    create policy users_insert_self on public.users for insert with check (id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_update_self'
  ) then
    create policy users_update_self on public.users for update using (id = auth.uid());
  end if;
end $$;

