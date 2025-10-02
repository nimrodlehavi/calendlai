-- Temporary OAuth state store for connecting external providers
create table if not exists public.oauth_states (
  state text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null,
  created_at timestamptz default now()
);

-- No RLS required; accessed via service role only from the server routes
alter table public.oauth_states disable row level security;

