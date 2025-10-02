import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServerClient as supabase } from '../../../lib/supabaseClient';
import { supabaseServiceClient } from '../../../lib/supabaseServiceClient';
import { google } from 'googleapis';
import { getHostGoogleAccessToken } from '../../../lib/googleTokens';
import { sendBookingEmail } from '../../../lib/email';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.body as { id?: string };
  if (!id) return res.status(400).json({ error: 'Missing id' });

  // Load booking
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, user_id, event_type_id, invitee_email, start_time, end_time, google_event_id')
    .eq('id', id)
    .single();
  if (bErr || !booking) return res.status(404).json({ error: 'Not found' });

  // Send reschedule email (no ICS) with booking link
  const origin = (req.headers.origin as string) || `${req.headers['x-forwarded-proto']||'http'}://${req.headers.host}`;
  const bookUrl = `${origin}/book/${booking.event_type_id}?email=${encodeURIComponent(booking.invitee_email || '')}`;
  try {
    await sendBookingEmail({
      to: booking.invitee_email,
      subject: 'Please reschedule your meeting',
      text: `Hi,\n\nWe need to reschedule your meeting. Please pick a new time here:\n${bookUrl}\n\nThank you!`,
      icsContent: '',
    });
  } catch (e:any) {
    console.error('Reschedule email failed', e);
  }

  // Delete Google event if exists
  if (booking.google_event_id && supabaseServiceClient) {
    try {
      const token = await getHostGoogleAccessToken(booking.user_id);
      if (token) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: token });
        const calendar = google.calendar({ version: 'v3', auth });
        await calendar.events.delete({ calendarId: 'primary', eventId: booking.google_event_id });
      }
    } catch (e) { console.error('Google delete failed', e); }
  }

  // Delete booking to free slot
  const { error: delErr } = await supabase.from('bookings').delete().eq('id', id);
  if (delErr) return res.status(400).json({ error: delErr.message });

  return res.status(200).json({ ok: true });
}
