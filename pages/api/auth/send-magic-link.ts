import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServiceClient } from '../../../lib/supabaseServiceClient';
import { Resend } from 'resend';
import { magicLinkEmailHTML } from '../../../lib/emailTemplates';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!supabaseServiceClient) return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });
    if (!resend) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

    const { email, redirectTo } = req.body as { email?: string; redirectTo?: string };
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const origin = (req.headers.origin as string) || `${req.headers['x-forwarded-proto']||'http'}://${req.headers.host}`;
    const redirect = redirectTo || `${origin}/`;

    // Generate Supabase magic link using service role
    const { data, error } = await (supabaseServiceClient as any).auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: redirect },
    });
    if (error || !data?.properties?.action_link) {
      console.error('generateLink error', error);
      return res.status(400).json({ error: error?.message || 'Failed to generate link' });
    }

    const actionLink: string = (data as any).properties.action_link;

    // Send branded email
    await (resend as any).emails.send({
      from: process.env.RESEND_FROM || process.env.EMAIL_FROM || 'CalendlAI <no-reply@calendlai.cronussystems.com>',
      to: email,
      subject: 'Your sign-in link',
      html: magicLinkEmailHTML({ brand: 'CalendlAI', link: actionLink }),
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('send-magic-link error', e);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}
