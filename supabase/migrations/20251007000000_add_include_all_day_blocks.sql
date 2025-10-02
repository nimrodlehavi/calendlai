alter table public.users
  add column if not exists include_all_day_blocks boolean default true;

update public.users
set include_all_day_blocks = coalesce(include_all_day_blocks, true);
