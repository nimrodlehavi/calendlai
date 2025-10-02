alter table users
  add column if not exists email text unique,
  add column if not exists username text unique,
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists created_at timestamp with time zone default now();

-- indexes (safe even if they already exist)
create index if not exists users_email_idx on users (email);
create index if not exists users_username_idx on users (username);
