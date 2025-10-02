-- Add missing columns to users table
alter table users
  add column if not exists email text,
  add column if not exists username text,
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists created_at timestamp with time zone default now();

-- Make email and username unique if they’re not already
create unique index if not exists users_email_key on users (email);
create unique index if not exists users_username_key on users (username);

-- Optional: standard non-unique indexes for fast lookup
create index if not exists users_email_idx on users (email);
create index if not exists users_username_idx on users (username);
