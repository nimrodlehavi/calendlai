// pages/api/bookings.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../lib/supabase";
import { google } from "googleapis";
import { generateICS } from "../../lib/ics";
import { sendBookingEmail } from "../../lib/email";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 📌 GET all bookings
  if (req.method === "GET") {
    const { data, error } = await supabase.from("bookings").select("*");
    if (error) return res.status(400).json({ error });
    return res.status(200).json({ bookings: data });
  }

  // 📌 CREATE a booking
  if (req.method === "POST") {
    const { event_type_id, invitee_email, start_time, end_time, access_token } = req.body;

    // 1. Save booking in Supabase
    const { data, error } = await supabase
      .from("bookings")
      .insert([{ event_type_id, invitee_email, start_time, end_time }])
      .select();

    if (error) return res.status(400).json({ error });
    const booking = data[0];

    // 2. Generate ICS
    const ics = generateICS({
      startIso: start_time,
      endIso: end_time,
      summary: "CalendlAI Booking",
      description: `Meeting with ${invitee_email}`,
      attendees: [{ email: invitee_email }],
    });

    // 3. Send email confirmation
    await sendBookingEmail({
      to: invitee_email,
      subject: "Your booking is confirmed",
      text: `Meeting on ${new Date(start_time).toLocaleString()}.`,
      icsContent: ics,
    });

    // 4. Create Google Calendar event if access_token provided
    if (access_token) {
      try {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token });

        const calendar = google.calendar({ version: "v3", auth });
        const gEvent = await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: "CalendlAI Booking",
            description: `Meeting with ${invitee_email}`,
            start: { dateTime: start_time },
            end: { dateTime: end_time },
            attendees: [{ email: invitee_email }],
          },
        });

        // Save Google event ID
        await supabase
          .from("bookings")
          .update({ google_event_id: gEvent.data.id })
          .eq("id", booking.id);
      } catch (err) {
        console.error("Google Calendar insert failed:", err);
      }
    }

    return res.status(200).json({ booking });
  }

  // 📌 UPDATE (reschedule) a booking
  if (req.method === "PUT") {
    const { id, start_time, end_time, access_token } = req.body;

    const { data, error } = await supabase
      .from("bookings")
      .update({ start_time, end_time })
      .eq("id", id)
      .select();

    if (error) return res.status(400).json({ error });
    const booking = data[0];

    // Update Google event if exists
    if (access_token && booking.google_event_id) {
      try {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token });

        const calendar = google.calendar({ version: "v3", auth });
        await calendar.events.update({
          calendarId: "primary",
          eventId: booking.google_event_id,
          requestBody: {
            start: { dateTime: start_time },
            end: { dateTime: end_time },
          },
        });
      } catch (err) {
        console.error("Google Calendar update failed:", err);
      }
    }

    return res.status(200).json({ booking });
  }

  // 📌 DELETE (cancel) a booking
  if (req.method === "DELETE") {
    const { id, access_token } = req.body;

    // Fetch booking to see if it has Google event
    const { data: booking } = await supabase
      .from("bookings")
      .select("google_event_id")
      .eq("id", id)
      .single();

    // Delete from Supabase
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) return res.status(400).json({ error });

    // Delete from Google Calendar if applicable
    if (access_token && booking?.google_event_id) {
      try {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token });

        const calendar = google.calendar({ version: "v3", auth });
        await calendar.events.delete({
          calendarId: "primary",
          eventId: booking.google_event_id,
        });
      } catch (err) {
        console.error("Google Calendar delete failed:", err);
      }
    }

    return res.status(200).json({ success: true });
  }

  // 📌 Method not allowed
  return res.status(405).json({ error: "Method not allowed" });
}
