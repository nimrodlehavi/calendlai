alter table bookings
  add column if not exists manage_token text unique;

create index if not exists bookings_manage_token_idx on bookings(manage_token);

