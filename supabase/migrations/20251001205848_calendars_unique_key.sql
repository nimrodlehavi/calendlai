   -- ensure composite key for upserts
    alter table public.calendars
      add constraint calendars_user_provider_key unique (user_id,
  provider);

    -- for safety if duplicates slipped in
    delete from public.calendars a
    using public.calendars b
    where a.user_id = b.user_id
      and a.provider = b.provider
      and a.ctid > b.ctid;
