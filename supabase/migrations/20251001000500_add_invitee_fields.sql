alter table bookings
  add column if not exists invitee_name text,
  add column if not exists notes text;

