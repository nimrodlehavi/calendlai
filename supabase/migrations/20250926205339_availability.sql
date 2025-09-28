-- Recurring weekly availability (e.g., Mondays 9–17)
create table if not exists availability_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  day_of_week int not null check (day_of_week >= 0 and day_of_week <= 6), -- 0=Sunday
  start_time time not null,
  end_time time not null
);

-- One-off blocks (vacations, overrides)
create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null
);
