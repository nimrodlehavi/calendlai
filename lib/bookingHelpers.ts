import { google } from "googleapis";
import { supabaseServerClient as supabase } from "./supabaseClient";
import { supabaseServiceClient } from "./supabaseServiceClient";
import { getHostGoogleAccessToken } from "./googleTokens";
import { hostHasConflict } from "./scheduling";
import type { EventTypeContext } from "./scheduling";
import { sendBookingEmail } from "./email";

export type EventContext = {
  eventType: EventTypeContext;
  hostIds: string[];
};

export async function selectHostForSlot(params: {
  context: EventContext;
  slotHosts: string[];
  slotStart: string;
  slotEnd: string;
  preferredHostId?: string | null;
}): Promise<string | null> {
  const { context, slotHosts, slotStart, slotEnd, preferredHostId } = params;
  const mode = context.eventType.scheduling_mode || "solo";

  if (mode === "solo") {
    return context.eventType.user_id ?? context.hostIds[0] ?? null;
  }

  const candidateSet = new Set<string>(slotHosts.filter(Boolean));
  if (candidateSet.size === 0) {
    for (const host of context.hostIds) candidateSet.add(host);
  }
  if (candidateSet.size === 0 && context.eventType.user_id) {
    candidateSet.add(context.eventType.user_id);
  }
  if (candidateSet.size === 0) return null;

  if (preferredHostId && candidateSet.has(preferredHostId)) {
    const conflict = await hostHasConflict(preferredHostId, slotStart, slotEnd);
    if (!conflict) {
      return preferredHostId;
    }
  }

  const candidates = Array.from(candidateSet);
  let counts: Record<string, number> = {};
  if (candidates.length > 0) {
    const { data: rows } = await supabase
      .from("bookings")
      .select("user_id")
      .in("user_id", candidates)
      .gte("start_time", new Date().toISOString());
    counts = (rows || []).reduce((acc: Record<string, number>, row: any) => {
      const key = row.user_id as string;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  const sorted = candidates.sort((a, b) => {
    const countA = counts[a] ?? 0;
    const countB = counts[b] ?? 0;
    if (countA !== countB) return countA - countB;
    return a.localeCompare(b);
  });

  for (const host of sorted) {
    const conflict = await hostHasConflict(host, slotStart, slotEnd);
    if (!conflict) {
      return host;
    }
  }

  return null;
}

export async function fetchHostEmail(userId: string): Promise<string | null> {
  if (!supabaseServiceClient) return null;
  try {
    const { data } = await supabaseServiceClient
      .from("users")
      .select("email")
      .eq("id", userId)
      .single();
    return data?.email ?? null;
  } catch {
    return null;
  }
}

export async function createGoogleEventForHost(params: {
  hostId: string;
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  inviteeEmail: string;
  inviteeName?: string | null;
  explicitAccessToken?: string | null;
}): Promise<string | null> {
  const { hostId, summary, description, startIso, endIso, inviteeEmail, inviteeName, explicitAccessToken } = params;

  let tokenToUse = explicitAccessToken || null;
  if (!tokenToUse) {
    tokenToUse = await getHostGoogleAccessToken(hostId);
  }
  if (!tokenToUse) return null;

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: tokenToUse });
    const calendar = google.calendar({ version: "v3", auth });
    const event = await calendar.events.insert({
      calendarId: "primary",
      sendUpdates: "all",
      requestBody: {
        summary,
        description,
        start: { dateTime: startIso },
        end: { dateTime: endIso },
        attendees: [{ email: inviteeEmail, displayName: inviteeName || undefined }],
        guestsCanSeeOtherGuests: true,
        guestsCanInviteOthers: false,
        anyoneCanAddSelf: false,
      },
    });
    return event.data.id ?? null;
  } catch (error) {
    console.error("Google Calendar insert failed", error);
    return null;
  }
}

export async function deleteGoogleEventForHost(params: {
  hostId: string;
  googleEventId: string;
  explicitAccessToken?: string | null;
}) {
  const { hostId, googleEventId, explicitAccessToken } = params;
  let tokenToUse = explicitAccessToken || null;
  if (!tokenToUse) tokenToUse = await getHostGoogleAccessToken(hostId);
  if (!tokenToUse) return;

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: tokenToUse });
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.delete({ calendarId: "primary", eventId: googleEventId });
  } catch (error) {
    console.error("Google Calendar delete failed", error);
  }
}

export async function notifyHostOfChange(
  previousHostId: string,
  newHostId: string,
  inviteeEmail: string,
  startIso: string,
  manageUrl: string | null,
  icsContent: string,
) {
  const text = manageUrl
    ? `Booking for ${inviteeEmail} moved to ${new Date(startIso).toLocaleString()}.
Manage: ${manageUrl}`
    : `Booking for ${inviteeEmail} moved to ${new Date(startIso).toLocaleString()}.`;

  if (previousHostId && previousHostId !== newHostId) {
    const prevEmail = await fetchHostEmail(previousHostId);
    if (prevEmail) {
      await sendBookingEmail({ to: prevEmail, subject: "Booking reassigned", text, icsContent });
    }
  }
  const newEmail = await fetchHostEmail(newHostId);
  if (newEmail) {
    await sendBookingEmail({ to: newEmail, subject: "Updated booking", text, icsContent });
  }
}

export async function syncGoogleEventForReschedule(params: {
  previousHostId: string;
  newHostId: string;
  googleEventId: string | null;
  start: string;
  end: string;
  inviteeEmail: string;
  inviteeName?: string | null;
  notes?: string | null;
  explicitAccessToken?: string | null;
}): Promise<string | null | undefined> {
  const { previousHostId, newHostId, googleEventId, start, end, inviteeEmail, inviteeName, notes, explicitAccessToken } = params;

  if (googleEventId && previousHostId === newHostId) {
    let tokenToUse = explicitAccessToken || null;
    if (!tokenToUse) tokenToUse = await getHostGoogleAccessToken(newHostId);
    if (!tokenToUse) return undefined;
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: tokenToUse });
      const calendar = google.calendar({ version: "v3", auth });
      await calendar.events.update({
        calendarId: "primary",
        eventId: googleEventId,
        sendUpdates: "all",
        requestBody: {
          start: { dateTime: start },
          end: { dateTime: end },
        },
      });
    } catch (error) {
      console.error("Google Calendar update failed", error);
    }
    return undefined;
  }

  if (googleEventId && previousHostId && previousHostId !== newHostId) {
    await deleteGoogleEventForHost({ hostId: previousHostId, googleEventId, explicitAccessToken });
  }

  const newEventId = await createGoogleEventForHost({
    hostId: newHostId,
    summary: "CalendlAI Booking",
    description: `Meeting with ${inviteeName || inviteeEmail}${notes ? `\n\nBackground:\n${notes}` : ""}`,
    startIso: start,
    endIso: end,
    inviteeEmail,
    inviteeName,
    explicitAccessToken,
  });

  if (newEventId) {
    return newEventId;
  }
  return null;
}
