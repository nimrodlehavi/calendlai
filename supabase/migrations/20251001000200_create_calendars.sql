-- Calendars table to store provider connections (tokens optional for now)
create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('google','microsoft','zoom')),
  access_token text,
  refresh_token text,
  scope text,
  expires_at timestamptz,
  primary_calendar_id text,
  created_at timestamptz default now()
);

alter table public.calendars enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='calendars' and policyname='calendars_select_self'
  ) then
    create policy calendars_select_self on public.calendars for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='calendars' and policyname='calendars_insert_self'
  ) then
    create policy calendars_insert_self on public.calendars for insert with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='calendars' and policyname='calendars_update_self'
  ) then
    create policy calendars_update_self on public.calendars for update using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='calendars' and policyname='calendars_delete_self'
  ) then
    create policy calendars_delete_self on public.calendars for delete using (user_id = auth.uid());
  end if;
end $$;

