import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServerClient as supabase } from "../../../../lib/supabaseClient";
import { generateICS } from "../../../../lib/ics";
import { sendBookingEmail } from "../../../../lib/email";
import {
  fetchEventTypeContext,
  computeSlotsForDate,
  normalizeSlotStart,
} from "../../../../lib/scheduling";
import {
  selectHostForSlot,
  fetchHostEmail,
  createGoogleEventForHost,
  deleteGoogleEventForHost,
  notifyHostOfChange,
  syncGoogleEventForReschedule,
} from "../../../../lib/bookingHelpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query as { token: string };
  if (!token) return res.status(400).json({ error: "Missing token" });

  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select("id, user_id, event_type_id, invitee_email, invitee_name, notes, start_time, end_time, google_event_id, manage_token")
    .eq("manage_token", token)
    .single();

  if (bErr || !booking) return res.status(404).json({ error: "Not found" });

  if (req.method === "GET") {
    return res.status(200).json({ booking });
  }

  if (req.method === "PUT") {
    const { start_time, host_user_id } = req.body as { start_time?: string; host_user_id?: string };
    if (!start_time) return res.status(400).json({ error: "Missing start_time" });

    try {
      const context = await fetchEventTypeContext(booking.event_type_id);
      if (context.eventType.scheduling_mode === "collective") {
        return res.status(400).json({ error: "Collective team events are not yet supported" });
      }

      const startDate = new Date(start_time);
      if (Number.isNaN(startDate.getTime())) {
        return res.status(400).json({ error: "Invalid start_time" });
      }

      const normalizedStart = normalizeSlotStart(startDate);
      const duration = context.eventType.duration_minutes || 30;
      const normalizedEnd = new Date(new Date(normalizedStart).getTime() + duration * 60000).toISOString();

      const slots = await computeSlotsForDate(
        context.eventType,
        context.hostIds,
        normalizedStart.slice(0, 10),
        { hostPreferences: context.hostPreferences },
      );
      const slot = slots.find((s) => s.start === normalizedStart);
      if (!slot) {
        return res.status(409).json({ error: "Selected time is no longer available" });
      }

      const chosenHost = await selectHostForSlot({
        context,
        slotHosts: slot.host_user_ids,
        slotStart: normalizedStart,
        slotEnd: normalizedEnd,
        preferredHostId: host_user_id || booking.user_id,
      });

      if (!chosenHost) {
        return res.status(409).json({ error: "No host available for this time" });
      }

      const { data, error } = await supabase
        .from("bookings")
        .update({ start_time: normalizedStart, end_time: normalizedEnd, user_id: chosenHost })
        .eq("id", booking.id)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });

      const inviteeEmail = booking.invitee_email;
      const inviteeName = booking.invitee_name;

      const ics = generateICS({
        startIso: normalizedStart,
        endIso: normalizedEnd,
        summary: "CalendlAI Booking",
        description: `Meeting with ${inviteeName || inviteeEmail}${booking.notes ? `\n\nBackground:\n${booking.notes}` : ""}`,
        attendees: [{ email: inviteeEmail, name: inviteeName || undefined }],
      });

      const origin =
        (req.headers.origin as string) || `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
      const manageUrl = booking.manage_token ? `${origin}/manage/${booking.manage_token}` : null;

      await sendBookingEmail({
        to: inviteeEmail,
        subject: "Booking updated",
        text: manageUrl
          ? `Your meeting is now on ${new Date(normalizedStart).toLocaleString()}.
Manage: ${manageUrl}`
          : `Your meeting is now on ${new Date(normalizedStart).toLocaleString()}.`,
        icsContent: ics,
      });

      if (booking.user_id !== chosenHost) {
        await notifyHostOfChange(booking.user_id, chosenHost, inviteeEmail, normalizedStart, manageUrl, ics);
      } else {
        const hostEmail = await fetchHostEmail(chosenHost);
        if (hostEmail) {
          await sendBookingEmail({
            to: hostEmail,
            subject: "Updated booking",
            text: manageUrl
              ? `Booking with ${inviteeEmail} moved to ${new Date(normalizedStart).toLocaleString()}.
Manage: ${manageUrl}`
              : `Booking with ${inviteeEmail} moved to ${new Date(normalizedStart).toLocaleString()}.`,
            icsContent: ics,
          });
        }
      }

      const syncResult = await syncGoogleEventForReschedule({
        previousHostId: booking.user_id,
        newHostId: chosenHost,
        googleEventId: booking.google_event_id,
        start: normalizedStart,
        end: normalizedEnd,
        inviteeEmail,
        inviteeName,
        notes: booking.notes,
        explicitAccessToken: null,
      });
     if (syncResult !== undefined) {
       await supabase
         .from("bookings")
         .update({ google_event_id: syncResult })
         .eq("id", booking.id);
        data.google_event_id = syncResult;
      }

      return res.status(200).json({ booking: data });
    } catch (error: any) {
      console.error("Public reschedule failed", error);
      return res.status(500).json({ error: String(error.message || error) });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
      if (error) return res.status(400).json({ error: error.message });

      if (booking.google_event_id) {
        await deleteGoogleEventForHost({ hostId: booking.user_id, googleEventId: booking.google_event_id, explicitAccessToken: null });
      }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Public cancel failed", error);
      return res.status(500).json({ error: String(error.message || error) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
