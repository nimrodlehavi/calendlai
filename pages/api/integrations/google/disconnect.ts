import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseServerClient } from "../../../../lib/supabaseClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  if (!token) return res.status(401).json({ error: 'Missing Authorization token' });

  const supabase = createSupabaseServerClient(token);
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return res.status(401).json({ error: 'Invalid session' });

  const { error } = await supabase
    .from('calendars')
    .delete()
    .eq('user_id', userRes.user.id)
    .eq('provider', 'google');

  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
