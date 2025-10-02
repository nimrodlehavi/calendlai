import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServerClient } from "../../../lib/supabaseClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { username } = req.query as { username?: string };
  if (!username || username.length < 3) return res.status(400).json({ error: 'Invalid username' });

  const { data, error } = await supabaseServerClient
    .from('users')
    .select('id')
    .ilike('username', username)
    .limit(1)
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ available: !data });
}

