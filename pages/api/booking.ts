import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServerClient as supabase } from "../../lib/supabaseClient";
import { supabaseServiceClient } from "../../lib/supabaseServiceClient";
import { google } from "googleapis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("bookings").select("*");
    if (error) return res.status(400).json({ error });
    return res.status(200).json({ bookings: data });
  }

  if (req.method === "POST") {
    const { event_type_id, invitee_email, invitee_name, notes, start_time, end_time, access_token } = req.body;

    // 1. Save booking in Supabase
    const { data, error } = await supabase
      .from("bookings")
      .insert([{ event_type_id, invitee_email, invitee_name, notes, start_time, end_time }])
      .select();

    if (error) return res.status(400).json({ error });

    // 2. Create Google Calendar event when possible (prefer stored token)
    let tokenToUse: string | null = access_token || null;
    if (!tokenToUse && supabaseServiceClient) {
      try {
        const { data: et } = await supabase
          .from('event_types')
          .select('user_id')
          .eq('id', event_type_id)
          .single();
        if (et?.user_id) {
          const { data: cal } = await supabaseServiceClient
            .from('calendars')
            .select('access_token')
            .eq('user_id', et.user_id)
            .eq('provider', 'google')
            .maybeSingle();
          if (cal?.access_token) tokenToUse = cal.access_token;
        }
      } catch (e) { console.error('Calendar lookup failed', e); }
    }
    if (tokenToUse) {
      try {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: tokenToUse });

        const calendar = google.calendar({ version: "v3", auth });
        await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: "CalendlAI Booking",
            description: `Meeting with ${invitee_name || invitee_email}${notes ? `\n\nBackground:\n${notes}` : ''}`,
            start: { dateTime: start_time },
            end: { dateTime: end_time },
            attendees: [{ email: invitee_email, displayName: invitee_name || undefined }],
          },
        });
      } catch (err) {
        console.error("Google Calendar insert failed:", err);
      }
    }

    return res.status(200).json({ bookings: data });
  }

  res.status(405).json({ error: "Method not allowed" });
}
