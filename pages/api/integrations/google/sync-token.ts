import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseServerClient } from "../../../../lib/supabaseClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  if (!token) return res.status(401).json({ error: 'Missing Authorization token' });

  const supabase = createSupabaseServerClient(token);
  const [{ data: userRes, error: userErr }, { data: sessionRes, error: sessionErr }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  if (userErr || !userRes?.user || sessionErr) return res.status(401).json({ error: 'Invalid session' });

  const anySess: any = sessionRes.session ?? {};
  const provider_token: string | undefined = anySess.provider_token;
  const provider_refresh_token: string | undefined = anySess.provider_refresh_token;
  const scope: string | undefined = anySess.provider_scope;

  // Upsert calendars row using RLS (user context from Authorization header)
  const payload: any = {
    user_id: userRes.user.id,
    provider: 'google',
    access_token: provider_token || null,
    refresh_token: provider_refresh_token || null,
    scope: scope || 'https://www.googleapis.com/auth/calendar',
  };

  const { error } = await supabase.from('calendars')
    .upsert(payload, { onConflict: 'user_id,provider' })
    .select('id')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
