-- Create reminders table to log sent emails (avoid duplicates)
create table if not exists reminders_sent (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  reminder_type text check (reminder_type in ('24h','1h')),
  sent_at timestamptz default now()
);

-- Function to find due reminders and call edge function
create or replace function send_due_reminders()
returns void
language plpgsql
as $$
declare
  b record;
  reminder_type text;
  cutoff timestamptz;
begin
  for reminder_type, cutoff in
    select '24h', now() + interval '24 hours'
    union all
    select '1h', now() + interval '1 hours'
  loop
    for b in
      select * from bookings
      where start_time between (cutoff - interval '1 minute') and (cutoff + interval '1 minute')
      and not exists (
        select 1 from reminders_sent r
        where r.booking_id = bookings.id and r.reminder_type = reminder_type
      )
    loop
      -- Call Edge Function to send email
      perform
        net.http_post(
          url := current_setting('app.settings.reminder_function_url'),
          body := json_build_object(
            'booking_id', b.id,
            'invitee_email', b.invitee_email,
            'start_time', b.start_time,
            'end_time', b.end_time,
            'reminder_type', reminder_type
          )::text,
          headers := json_build_object('Authorization', current_setting('app.settings.reminder_function_key'))
        );

      insert into reminders_sent (booking_id, reminder_type) values (b.id, reminder_type);
    end loop;
  end loop;
end;
$$;

-- Schedule it every 15 min
select cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  'select send_due_reminders();'
);
