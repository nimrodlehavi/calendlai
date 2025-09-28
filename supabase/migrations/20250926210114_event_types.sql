-- Event types (user-defined meeting templates)
create table if not exists event_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  duration_minutes int not null check (duration_minutes > 0),
  buffer_before int default 0, -- minutes
  buffer_after int default 0,
  min_notice_minutes int default 60,
  daily_cap int default null,
  timezone text default 'UTC',
  created_at timestamptz default now()
);

-- Bookings (invitee-scheduled meetings)
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  event_type_id uuid references event_types(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invitee_email text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  created_at timestamptz default now()
);
