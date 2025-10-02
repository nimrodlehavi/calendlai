import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";
import crypto from "crypto";
import { createSupabaseServerClient } from "../../../../lib/supabaseClient";
import { supabaseServiceClient } from "../../../../lib/supabaseServiceClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!supabaseServiceClient) return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });

    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;
    if (!token) return res.status(401).json({ error: 'Missing Authorization token' });

  const supabase = createSupabaseServerClient(token);
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return res.status(401).json({ error: 'Invalid session' });

    const clientId = process.env.GOOGLE_CLIENT_ID as string;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET as string;
    if (!clientId || !clientSecret) return res.status(500).json({ error: 'Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET' });

    const origin = req.headers.origin || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
    const redirectUri = `${origin}/api/integrations/google/callback`;

  const state = crypto.randomBytes(16).toString('hex');
  const { error: insertErr } = await supabaseServiceClient.from('oauth_states').insert({ state, user_id: userRes.user.id, provider: 'google' });
    if (insertErr) {
      console.error('oauth_states insert error', insertErr);
      return res.status(500).json({ error: 'Failed to initialize OAuth state (migrations applied?)' });
    }

    const { OAuth2 } = google.auth;
    const client = new OAuth2(clientId, clientSecret, redirectUri);
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['openid','email','profile','https://www.googleapis.com/auth/calendar'],
      state,
    });

    return res.status(200).json({ url });
  } catch (e: any) {
    console.error('google/start error', e);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}
