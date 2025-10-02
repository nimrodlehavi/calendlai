-- Day 7: host pages + team scheduling foundation
-- Adds slugs & public metadata to event types, introduces teams & event_type_hosts, and exposes RPCs for public host pages.

-- Helper slugify function (idempotent definition)
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select case
    when input is null or length(trim(input)) = 0 then null
    else lower(regexp_replace(trim(input), '[^a-zA-Z0-9]+', '-', 'g'))
  end;
$$;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz default now()
);

create unique index if not exists teams_owner_slug_idx on public.teams (owner_id, slug);

-- Team membership table
create table if not exists public.team_members (
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  role text default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz default now(),
  primary key (team_id, user_id)
);

alter table public.teams enable row level security;

create policy teams_owner_policy_select on public.teams
  for select
  using (
    owner_id = auth.uid() or
    exists (
      select 1
      from public.team_members tm
      where tm.team_id = teams.id and tm.user_id = auth.uid()
    )
  );

create policy teams_owner_policy_insert on public.teams
  for insert
  with check (owner_id = auth.uid());

create policy teams_owner_policy_update on public.teams
  for update
  using (owner_id = auth.uid());

create policy teams_owner_policy_delete on public.teams
  for delete
  using (owner_id = auth.uid());

alter table public.team_members enable row level security;

create policy team_members_select on public.team_members
  for select
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.teams t
      where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );

create policy team_members_insert on public.team_members
  for insert
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );

create policy team_members_update on public.team_members
  for update
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );

create policy team_members_delete on public.team_members
  for delete
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );

-- Event type metadata for public pages & teams (add columns now that teams table exists)
alter table public.event_types
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists is_public boolean default true,
  add column if not exists scheduling_mode text default 'solo' check (scheduling_mode in ('solo','round_robin','collective')),
  add column if not exists team_id uuid references public.teams(id);

alter table public.event_types
  alter column scheduling_mode set default 'solo';

-- Event type hosts (used for round-robin & collective scheduling)
create table if not exists public.event_type_hosts (
  event_type_id uuid references public.event_types(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  priority int default 0,
  created_at timestamptz default now(),
  primary key (event_type_id, user_id)
);

alter table public.event_type_hosts enable row level security;

create policy event_type_hosts_select on public.event_type_hosts
  for select
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.event_types et
      where et.id = event_type_hosts.event_type_id
        and (
          et.user_id = auth.uid() or
          (et.team_id is not null and exists (
            select 1 from public.team_members tm
            where tm.team_id = et.team_id and tm.user_id = auth.uid()
          ))
        )
    )
  );

create policy event_type_hosts_insert on public.event_type_hosts
  for insert
  with check (
    exists (
      select 1 from public.event_types et
      where et.id = event_type_hosts.event_type_id
        and (
          et.user_id = auth.uid() or
          (et.team_id is not null and exists (
            select 1 from public.team_members tm
            where tm.team_id = et.team_id and tm.user_id = auth.uid() and tm.role in ('owner','admin')
          ))
        )
    )
  );

create policy event_type_hosts_update on public.event_type_hosts
  for update
  using (
    exists (
      select 1 from public.event_types et
      where et.id = event_type_hosts.event_type_id
        and (
          et.user_id = auth.uid() or
          (et.team_id is not null and exists (
            select 1 from public.team_members tm
            where tm.team_id = et.team_id and tm.user_id = auth.uid() and tm.role in ('owner','admin')
          ))
        )
    )
  )
  with check (
    exists (
      select 1 from public.event_types et
      where et.id = event_type_hosts.event_type_id
        and (
          et.user_id = auth.uid() or
          (et.team_id is not null and exists (
            select 1 from public.team_members tm
            where tm.team_id = et.team_id and tm.user_id = auth.uid() and tm.role in ('owner','admin')
          ))
        )
    )
  );

create policy event_type_hosts_delete on public.event_type_hosts
  for delete
  using (
    exists (
      select 1 from public.event_types et
      where et.id = event_type_hosts.event_type_id
        and (
          et.user_id = auth.uid() or
          (et.team_id is not null and exists (
            select 1 from public.team_members tm
            where tm.team_id = et.team_id and tm.user_id = auth.uid() and tm.role in ('owner','admin')
          ))
        )
    )
  );

-- Backfill data for existing rows
update public.event_types
set slug = coalesce(slug, public.slugify(name))
where slug is null;

-- Guarantee slugs unique per owner (user) using row_number suffix
with slugged as (
  select
    id,
    user_id,
    team_id,
    case when coalesce(public.slugify(name), '') = '' then left(id::text, 8) else public.slugify(name) end as base_slug,
    row_number() over (
      partition by user_id, team_id, case when coalesce(public.slugify(name), '') = '' then left(id::text, 8) else public.slugify(name) end
      order by created_at, id
    ) as rn
  from public.event_types
)
update public.event_types et
set slug = case when slugged.rn = 1 then slugged.base_slug else slugged.base_slug || '-' || slugged.rn end
from slugged
where et.id = slugged.id;

alter table public.event_types
  alter column slug set not null;

create unique index if not exists event_types_user_slug_idx on public.event_types (user_id, slug) where team_id is null;
create unique index if not exists event_types_team_slug_idx on public.event_types (team_id, slug) where team_id is not null;

-- Ensure scheduling_mode default is enforced and existing values valid
update public.event_types
set scheduling_mode = 'solo'
where scheduling_mode is null or scheduling_mode not in ('solo','round_robin','collective');

-- Backfill event_type_hosts with owner
insert into public.event_type_hosts (event_type_id, user_id, priority)
select id, user_id, 0
from public.event_types
where user_id is not null
on conflict (event_type_id, user_id) do nothing;

-- Automatically add team owner as team member (if missing)
insert into public.team_members (team_id, user_id, role)
select t.id, t.owner_id, 'owner'
from public.teams t
on conflict (team_id, user_id) do nothing;

-- RPC: public host event types (for anonymous host pages)
create or replace function public.public_host_event_types(p_username text)
returns table (
  event_type_id uuid,
  slug text,
  name text,
  description text,
  duration_minutes int,
  scheduling_mode text,
  is_public boolean,
  team_name text,
  owner_display_name text,
  owner_username text
)
language sql
security definer
set search_path = public
as $$
  with target_user as (
    select id, username, coalesce(display_name, username) as display_label
    from public.users
    where username = p_username
    limit 1
  ),
  expanded as (
    select et.*
    from target_user u
    join public.event_types et on et.user_id = u.id
    union
    select et.*
    from target_user u
    join public.event_type_hosts eth on eth.user_id = u.id
    join public.event_types et on et.id = eth.event_type_id
  )
  select
    et.id,
    et.slug,
    et.name,
    et.description,
    et.duration_minutes,
    et.scheduling_mode,
    coalesce(et.is_public, true) as is_public,
    t.name as team_name,
    u.display_label as owner_display_name,
    u.username as owner_username
  from expanded et
  join target_user u on true
  left join public.teams t on et.team_id = t.id
  where coalesce(et.is_public, true) = true
  group by et.id, et.slug, et.name, et.description, et.duration_minutes, et.scheduling_mode, et.is_public, t.name, u.display_label, u.username
  order by et.name;
$$;

grant execute on function public.public_host_event_types(text) to anon, authenticated;

-- RPC: single host event type for public booking page (includes owner + metadata)
create or replace function public.public_host_event_type(p_username text, p_slug text)
returns table (
  event_type_id uuid,
  slug text,
  name text,
  description text,
  duration_minutes int,
  scheduling_mode text,
  owner_id uuid,
  owner_username text,
  owner_display_name text,
  owner_accent_color text,
  owner_timezone text,
  team_id uuid,
  team_name text
)
language sql
security definer
set search_path = public
as $$
  with target_user as (
    select id, username, coalesce(display_name, username) as display_label, accent_color, timezone
    from public.users
    where username = p_username
    limit 1
  ),
  candidate as (
    select et.*
    from target_user u
    join public.event_types et on et.user_id = u.id
    where et.slug = p_slug
    union all
    select et.*
    from target_user u
    join public.event_type_hosts eth on eth.user_id = u.id
    join public.event_types et on et.id = eth.event_type_id
    where et.slug = p_slug
  )
  select
    et.id,
    et.slug,
    et.name,
    et.description,
    et.duration_minutes,
    et.scheduling_mode,
    et.user_id,
    tu.username,
    tu.display_label,
    tu.accent_color,
    tu.timezone,
    et.team_id,
    t.name as team_name
  from candidate et
  join target_user tu on true
  left join public.teams t on t.id = et.team_id
  where coalesce(et.is_public, true) = true
  limit 1;
$$;

grant execute on function public.public_host_event_type(text, text) to anon, authenticated;

-- Ensure event_type_hosts accessible for public function execution
revoke all on function public.public_host_event_types(text) from public;
revoke all on function public.public_host_event_type(text, text) from public;
