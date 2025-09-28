import type { NextApiRequest, NextApiResponse } from "next"
import { supabase } from "../../lib/supabase"
import { google } from "googleapis"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("bookings").select("*")
    if (error) return res.status(400).json({ error })
    return res.status(200).json({ bookings: data })
  }

  if (req.method === "POST") {
    const { event_type_id, invitee_email, start_time, end_time, access_token } = req.body

    // 1. Save booking in Supabase
    const { data, error } = await supabase
      .from("bookings")
      .insert([{ event_type_id, invitee_email, start_time, end_time }])
      .select()

    if (error) return res.status(400).json({ error })

    // 2. If Google access_token provided, also create Google Calendar event
    if (access_token) {
      try {
        const auth = new google.auth.OAuth2()
        auth.setCredentials({ access_token })

        const calendar = google.calendar({ version: "v3", auth })
        await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: "CalendlAI Booking",
            description: `Meeting with ${invitee_email}`,
            start: { dateTime: start_time },
            end: { dateTime: end_time },
            attendees: [{ email: invitee_email }]
          }
        })
      } catch (err) {
        console.error("Google Calendar insert failed:", err)
      }
    }

    return res.status(200).json({ bookings: data })
  }

  res.status(405).json({ error: "Method not allowed" })
}
