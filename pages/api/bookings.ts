export const config = {
  runtime: "nodejs",
};

import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabaseServerClient as supabase } from "../../lib/supabaseClient";
import { generateICS } from "../../lib/ics";
import { sendBookingEmail } from "../../lib/email";
import {
  fetchEventTypeContext,
  computeSlotsForDate,
  normalizeSlotStart,
} from "../../lib/scheduling";
import {
  selectHostForSlot,
  fetchHostEmail,
  createGoogleEventForHost,
  deleteGoogleEventForHost,
  notifyHostOfChange,
  syncGoogleEventForReschedule,
} from "../../lib/bookingHelpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("bookings").select("*");
    if (error) return res.status(400).json({ error });
    return res.status(200).json({ bookings: data });
  }

  if (req.method === "POST") {
    return handleCreateBooking(req, res);
  }

  if (req.method === "PUT") {
    return handleUpdateBooking(req, res);
  }

  if (req.method === "DELETE") {
    return handleDeleteBooking(req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function handleCreateBooking(req: NextApiRequest, res: NextApiResponse) {
  const {
    event_type_id,
    invitee_email,
    invitee_name,
    notes,
    start_time,
    access_token,
    host_user_id,
  } = req.body as Record<string, any>;

  if (!event_type_id || !invitee_email || !start_time) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const inviteeEmail = String(invitee_email).trim();
    const inviteeName = invitee_name ? String(invitee_name).trim() : null;
    const noteText = notes ? String(notes).trim() : null;

    const context = await fetchEventTypeContext(event_type_id);
    if (context.eventType.scheduling_mode === "collective") {
      return res.status(400).json({ error: "Collective team events are not yet supported" });
    }

    const startDate = new Date(start_time);
    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ error: "Invalid start_time" });
    }

    const normalizedStart = normalizeSlotStart(startDate);
    const duration = context.eventType.duration_minutes || 30;
    const computedEndDate = new Date(new Date(normalizedStart).getTime() + duration * 60000);
    const computedEnd = computedEndDate.toISOString();

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

    const selectedHost = await selectHostForSlot({
      context,
      slotHosts: slot.host_user_ids,
      slotStart: normalizedStart,
      slotEnd: computedEnd,
      preferredHostId: host_user_id,
    });

    if (!selectedHost) {
      return res.status(409).json({ error: "No host available for this time" });
    }

    const manageToken = crypto.randomUUID();
    const baseInsert = {
      event_type_id,
      user_id: selectedHost,
      invitee_email: inviteeEmail,
      invitee_name: inviteeName,
      notes: noteText,
      start_time: normalizedStart,
      end_time: computedEnd,
      manage_token: manageToken,
    };

    const { data, error } = await supabase
      .from("bookings")
      .insert([baseInsert])
      .select()
      .single();
    if (error) {
      return res.status(400).json({ error });
    }

    const booking = data;
    const ics = generateICS({
      startIso: normalizedStart,
      endIso: computedEnd,
      summary: "CalendlAI Booking",
      description: `Meeting with ${inviteeName || inviteeEmail}${noteText ? `\n\nBackground:\n${noteText}` : ""}`,
      attendees: [{ email: inviteeEmail, name: inviteeName || undefined }],
    });

    const origin =
      (req.headers.origin as string) || `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
    const manageUrl = manageToken ? `${origin}/manage/${manageToken}` : null;

    await sendBookingEmail({
      to: inviteeEmail,
      subject: "Your booking is confirmed",
      text: manageUrl
        ? `Meeting on ${new Date(normalizedStart).toLocaleString()}.
Reschedule: ${manageUrl}
Cancel: ${manageUrl}?cancel=1`
        : `Meeting on ${new Date(normalizedStart).toLocaleString()}.`,
      icsContent: ics,
    });

    const hostEmail = await fetchHostEmail(selectedHost);
    if (hostEmail) {
      await sendBookingEmail({
        to: hostEmail,
        subject: "New booking",
        text: manageUrl
          ? `New booking with ${inviteeEmail} on ${new Date(normalizedStart).toLocaleString()}.
Manage: ${manageUrl}`
          : `New booking with ${inviteeEmail} on ${new Date(normalizedStart).toLocaleString()}.`,
        icsContent: ics,
      });
    }

    const googleEventId = await createGoogleEventForHost({
      hostId: selectedHost,
      explicitAccessToken: access_token,
      summary: "CalendlAI Booking",
      description: `Meeting with ${inviteeName || inviteeEmail}${noteText ? `\n\nBackground:\n${noteText}` : ""}`,
      startIso: normalizedStart,
      endIso: computedEnd,
      inviteeEmail,
      inviteeName,
    });

    if (googleEventId) {
      await supabase
        .from("bookings")
        .update({ google_event_id: googleEventId })
        .eq("id", booking.id);
      booking.google_event_id = googleEventId; // keep response up to date
    }

    return res.status(200).json({ booking });
  } catch (error: any) {
    console.error("Create booking failed", error);
    return res.status(500).json({ error: String(error.message || error) });
  }
}

async function handleUpdateBooking(req: NextApiRequest, res: NextApiResponse) {
  const { id, start_time, host_user_id, access_token } = req.body as Record<string, any>;
  if (!id || !start_time) {
    return res.status(400).json({ error: "Missing id or start_time" });
  }

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("bookings")
      .select("id, event_type_id, user_id, google_event_id, invitee_email, invitee_name, notes, manage_token")
      .eq("id", id)
      .single();
    if (fetchErr || !existing) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const context = await fetchEventTypeContext(existing.event_type_id);
    if (context.eventType.scheduling_mode === "collective") {
      return res.status(400).json({ error: "Collective team events are not yet supported" });
    }

    const newStartDate = new Date(start_time);
    if (Number.isNaN(newStartDate.getTime())) {
      return res.status(400).json({ error: "Invalid start_time" });
    }

    const normalizedStart = normalizeSlotStart(newStartDate);
    const duration = context.eventType.duration_minutes || 30;
    const newEndDate = new Date(new Date(normalizedStart).getTime() + duration * 60000);
    const normalizedEnd = newEndDate.toISOString();

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
      preferredHostId: host_user_id || existing.user_id,
    });

    if (!chosenHost) {
      return res.status(409).json({ error: "No host available for this time" });
    }

    const { data: updated, error: updateErr } = await supabase
      .from("bookings")
      .update({ start_time: normalizedStart, end_time: normalizedEnd, user_id: chosenHost })
      .eq("id", id)
      .select()
      .single();
    if (updateErr || !updated) {
      return res.status(400).json({ error: updateErr });
    }

    const newBooking = updated;
    const inviteeEmail = existing.invitee_email;
    const inviteeName = existing.invitee_name;

    const ics = generateICS({
      startIso: normalizedStart,
      endIso: normalizedEnd,
      summary: "CalendlAI Booking",
      description: `Meeting with ${inviteeName || inviteeEmail}${existing.notes ? `\n\nBackground:\n${existing.notes}` : ""}`,
      attendees: [{ email: inviteeEmail, name: inviteeName || undefined }],
    });

    const origin =
      (req.headers.origin as string) || `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
    const manageUrl = existing.manage_token ? `${origin}/manage/${existing.manage_token}` : null;

    await sendBookingEmail({
      to: inviteeEmail,
      subject: "Booking updated",
      text: manageUrl
        ? `Your meeting is now on ${new Date(normalizedStart).toLocaleString()}.
Manage: ${manageUrl}`
        : `Your meeting is now on ${new Date(normalizedStart).toLocaleString()}.`,
      icsContent: ics,
    });

    if (existing.user_id !== chosenHost) {
      await notifyHostOfChange(existing.user_id, chosenHost, inviteeEmail, normalizedStart, manageUrl, ics);
    }

    const syncResult = await syncGoogleEventForReschedule({
      previousHostId: existing.user_id,
      newHostId: chosenHost,
      googleEventId: existing.google_event_id,
      start: normalizedStart,
      end: normalizedEnd,
      inviteeEmail,
      inviteeName,
      notes: existing.notes,
      explicitAccessToken: access_token,
    });
    if (syncResult !== undefined) {
      await supabase
        .from("bookings")
        .update({ google_event_id: syncResult })
        .eq("id", id);
      newBooking.google_event_id = syncResult;
    }

    return res.status(200).json({ booking: newBooking });
  } catch (error: any) {
    console.error("Update booking failed", error);
    return res.status(500).json({ error: String(error.message || error) });
  }
}

async function handleDeleteBooking(req: NextApiRequest, res: NextApiResponse) {
  const { id, access_token } = req.body as Record<string, any>;
  if (!id) {
    return res.status(400).json({ error: "Missing id" });
  }

  try {
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, user_id, google_event_id, invitee_email")
      .eq("id", id)
      .single();
    if (error || !booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const { error: deleteErr } = await supabase.from("bookings").delete().eq("id", id);
    if (deleteErr) {
      return res.status(400).json({ error: deleteErr });
    }

    if (booking.google_event_id) {
      await deleteGoogleEventForHost({
        hostId: booking.user_id,
        googleEventId: booking.google_event_id,
        explicitAccessToken: access_token,
      });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Delete booking failed", error);
    return res.status(500).json({ error: String(error.message || error) });
  }
}
