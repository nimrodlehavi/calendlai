-- Host profile fields, host profile RPC for public pages
DROP VIEW IF EXISTS public.host_profiles;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS accent_color text;

UPDATE public.users
SET accent_color = '#2563eb'
WHERE accent_color IS NULL;

ALTER TABLE public.users
  ALTER COLUMN accent_color SET DEFAULT '#2563eb';

CREATE OR REPLACE FUNCTION public.public_host_profile(p_username text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  headline text,
  bio text,
  avatar_url text,
  pronouns text,
  location text,
  website_url text,
  accent_color text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.username,
    u.display_name,
    u.headline,
    u.bio,
    u.avatar_url,
    u.pronouns,
    u.location,
    u.website_url,
    COALESCE(u.accent_color, '#2563eb') AS accent_color,
    u.created_at
  FROM public.users u
  WHERE u.username = p_username
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.public_host_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_host_profile(text) TO anon, authenticated;
