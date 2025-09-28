ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS google_event_id text;
