import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";
import { supabaseServiceClient } from "../../../../lib/supabaseServiceClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    if (!supabaseServiceClient) return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });

    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) return res.status(400).json({ error: 'Missing code/state' });

    const { data: row, error: rowErr } = await supabaseServiceClient
      .from('oauth_states')
      .select('user_id')
      .eq('state', state)
      .single();
    if (rowErr || !row) return res.status(400).json({ error: 'Invalid state' });

    const clientId = process.env.GOOGLE_CLIENT_ID as string;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET as string;
    if (!clientId || !clientSecret) return res.status(500).json({ error: 'Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET' });

    const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
    const redirectUri = `${origin}/api/integrations/google/callback`;

    const { OAuth2 } = google.auth;
    const client = new OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) {
      console.error('No access_token in tokens', tokens);
    }

    // Store tokens
    const payload: any = {
      user_id: row.user_id,
      provider: 'google',
      access_token: tokens.access_token || null,
      refresh_token: tokens.refresh_token || null,
      scope: tokens.scope || 'https://www.googleapis.com/auth/calendar',
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    };

    const { error: upErr } = await supabaseServiceClient
      .from('calendars')
      .upsert(payload, { onConflict: 'user_id,provider' });
    if (upErr) console.error('calendars upsert error', upErr);

    // Cleanup state
    await supabaseServiceClient.from('oauth_states').delete().eq('state', state);

    // Redirect back to settings with success flag
    res.redirect(302, '/settings?google=connected');
    return;
  } catch (e: any) {
    console.error('Google OAuth callback error', e);
    const msg = encodeURIComponent(e?.message || 'error');
    res.redirect(302, `/settings?google=error&msg=${msg}`);
    return;
  }
}
