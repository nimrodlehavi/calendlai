import { google } from "googleapis";
import { getHostGoogleAccessToken } from "./googleTokens";
import { supabaseServerClient as supabase } from "./supabaseClient";
import { supabaseServiceClient } from "./supabaseServiceClient";

const serviceClient = supabaseServiceClient ?? null;

export type SchedulingMode = "solo" | "round_robin" | "collective";

export type EventTypeContext = {
  id: string;
  name: string;
  user_id: string | null;
  duration_minutes: number;
  buffer_before: number | null;
  buffer_after: number | null;
  min_notice_minutes: number | null;
  scheduling_mode: SchedulingMode;
  team_id: string | null;
};

export type SlotOption = {
  start: string;
  host_user_ids: string[];
};

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const toIsoFloorSeconds = (date: Date) => {
  const copy = new Date(date);
  copy.setMilliseconds(0);
  copy.setSeconds(0);
  return copy.toISOString();
};

export const normalizeSlotStart = toIsoFloorSeconds;

export async function fetchEventTypeContext(eventTypeId: string): Promise<{
  eventType: EventTypeContext;
  hostIds: string[];
  hostPreferences: Record<string, boolean>;
}> {
  const client = serviceClient ?? supabase;
  let eventType: any;
  let error: any;

  if (client === supabase) {
    const res = await supabase.functions.invoke('fetch-event-type', {
      body: { event_type_id: eventTypeId },
    }).catch(() => null);

    if (res && res.data) {
      eventType = res.data;
      error = null;
    }

    if (!eventType) {
      const fallback = await client
        .from("event_types")
        .select(
          "id, name, user_id, duration_minutes, buffer_before, buffer_after, min_notice_minutes"
        )
        .eq("id", eventTypeId)
        .single();
      eventType = fallback.data ? { ...fallback.data, scheduling_mode: "solo", team_id: null } : null;
      error = fallback.error;
    }
  } else {
    const baseSelect = "id, name, user_id, duration_minutes, buffer_before, buffer_after, min_notice_minutes, scheduling_mode, team_id";
    const res = await client
      .from("event_types")
      .select(baseSelect)
      .eq("id", eventTypeId)
      .single();
    eventType = res.data;
    error = res.error;
  }

  if (error?.code === "42703" || (error && /scheduling_mode/.test(error.message || ""))) {
    const fallback = await client
      .from("event_types")
      .select("id, name, user_id, duration_minutes, buffer_before, buffer_after, min_notice_minutes, team_id")
      .eq("id", eventTypeId)
      .single();
    if (!fallback.error && fallback.data) {
      eventType = { ...fallback.data, scheduling_mode: "solo" } as any;
      error = null as any;
    }
  }

  if (error || !eventType) {
    console.error('[fetchEventTypeContext] event query error', eventTypeId, error);
    throw new Error("Event type not found");
  }

  const hostSet = new Set<string>();
  if (eventType.user_id) {
    hostSet.add(eventType.user_id);
  }

  const { data: hostRows, error: hostError } = await client
    .from("event_type_hosts")
    .select("user_id")
    .eq("event_type_id", eventTypeId);

  if (hostError) {
    console.error('[fetchEventTypeContext] host lookup error', eventTypeId, hostError);
  }

  for (const row of hostRows || []) {
    if (row.user_id) hostSet.add(row.user_id);
  }

  const hostIds = Array.from(hostSet);
  const includeAllDayByHost: Record<string, boolean> = {};
  hostIds.forEach((id) => {
    includeAllDayByHost[id] = true;
  });

  if (hostIds.length > 0) {
    const { data: prefs, error: prefError } = await client
      .from("users")
      .select("id, include_all_day_blocks")
      .in("id", hostIds);

    if (prefError) {
      console.error('[fetchEventTypeContext] preference lookup error', eventTypeId, prefError);
    }

    prefs?.forEach((row: any) => {
      if (row.include_all_day_blocks === false) {
        includeAllDayByHost[row.id] = false;
      }
    });
  }

  return { eventType: eventType as EventTypeContext, hostIds, hostPreferences: includeAllDayByHost };
}

export async function computeSlotsForDate(
  context: EventTypeContext,
  hostIds: string[],
  yyyymmdd: string,
  options: { skipGoogle?: boolean; hostPreferences?: Record<string, boolean> } = {}
): Promise<SlotOption[]> {
  const dayStart = new Date(`${yyyymmdd}T00:00:00Z`);
  if (Number.isNaN(dayStart.getTime())) {
    return [];
  }
  const minNoticeMinutes = context.min_notice_minutes ?? 60;
  const minStart = new Date(Date.now() + minNoticeMinutes * 60000);

  const mode: SchedulingMode = context.scheduling_mode ?? "solo";
  const hostsToEvaluate =
    mode === "solo" && context.user_id ? [context.user_id] : hostIds.length ? hostIds : context.user_id ? [context.user_id] : [];

  const slotMap = new Map<string, Set<string>>();
  const perHostSlots = new Map<string, Set<string>>();

  for (const hostId of hostsToEvaluate) {
    const includeAllDay = options.hostPreferences?.[hostId] ?? true;
    const slots = await computeHostSlotsForDate({
      hostId,
      context,
      dayStart,
      minStart,
      skipGoogle: options.skipGoogle ?? false,
      includeAllDayEvents: includeAllDay,
    });
    perHostSlots.set(hostId, slots);
  }

  if (mode === "collective") {
    if (!hostsToEvaluate.length) return [];
    const [firstHost, ...rest] = hostsToEvaluate;
    const baseSet = new Set(perHostSlots.get(firstHost) || []);
    for (const slot of baseSet) {
      const allAvailable = rest.every((host) => perHostSlots.get(host)?.has(slot));
      if (allAvailable) {
        slotMap.set(slot, new Set(hostsToEvaluate));
      }
    }
  } else {
    for (const [hostId, slots] of perHostSlots.entries()) {
      for (const slot of slots) {
        if (!slotMap.has(slot)) slotMap.set(slot, new Set());
        slotMap.get(slot)!.add(hostId);
      }
    }
  }

  const sorted = Array.from(slotMap.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([start, hosts]) => ({ start, host_user_ids: Array.from(hosts) }));

  return sorted;
}

async function computeHostSlotsForDate(params: {
  hostId: string;
  context: EventTypeContext;
  dayStart: Date;
  minStart: Date;
  skipGoogle: boolean;
  includeAllDayEvents: boolean;
}): Promise<Set<string>> {
  const { hostId, context, dayStart, minStart, skipGoogle, includeAllDayEvents } = params;
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const dow = dayStart.getUTCDay();

  const client = serviceClient ?? supabase;
  const { data: windows } = await client
    .from("availability_windows")
    .select("start_time, end_time")
    .eq("user_id", hostId)
    .eq("day_of_week", dow);

  if (!windows || windows.length === 0) {
    return new Set();
  }

  const { data: blocks } = await client
    .from("blocks")
    .select("start_time, end_time")
    .eq("user_id", hostId)
    .or(`start_time.lte.${dayEnd.toISOString()},end_time.gte.${dayStart.toISOString()}`);

  const { data: bookings } = await client
    .from("bookings")
    .select("start_time, end_time")
    .eq("user_id", hostId)
    .or(`start_time.lte.${dayEnd.toISOString()},end_time.gte.${dayStart.toISOString()}`);

  let gcalEvents: { start: string; end: string }[] = [];
  if (!skipGoogle && includeAllDayEvents) {
    try {
      const token = await getHostGoogleAccessToken(hostId);
      if (token) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: token });
        const calendar = google.calendar({ version: "v3", auth });
        const g = await calendar.events.list({
          calendarId: "primary",
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 2500,
        });
        gcalEvents = (g.data.items || [])
          .map((ev) => {
            const isAllDay = !!ev.start?.date && !ev.start?.dateTime;
            if (!includeAllDayEvents && isAllDay) return null;
            const s = (ev.start?.dateTime as string) || (ev.start?.date ? `${ev.start.date}T00:00:00Z` : undefined);
            const e = (ev.end?.dateTime as string) || (ev.end?.date ? `${ev.end.date}T00:00:00Z` : undefined);
            return s && e ? { start: s, end: e } : null;
          })
          .filter(Boolean) as { start: string; end: string }[];

        try {
          const calendarList = await calendar.calendarList.list({ maxResults: 50 });
          const holidayCalendars = (calendarList.data.items || []).filter((item) => {
            if (!item || item.deleted) return false;
            if (item.id?.includes("holiday@group.v.calendar.google.com")) return true;
            const name = item.summaryOverride || item.summary || "";
            return /holiday/i.test(name);
          });
          if (holidayCalendars.length > 0) {
            const holidayEventsArrays = await Promise.all(
              holidayCalendars.map(async (cal) => {
                if (!cal.id) return [] as { start: string; end: string }[];
                try {
                  const resp = await calendar.events.list({
                    calendarId: cal.id,
                    timeMin: dayStart.toISOString(),
                    timeMax: dayEnd.toISOString(),
                    singleEvents: true,
                    orderBy: "startTime",
                    maxResults: 100,
                  });
                  return (resp.data.items || [])
                    .map((ev) => {
                      const s = (ev.start?.dateTime as string) || (ev.start?.date ? `${ev.start.date}T00:00:00Z` : undefined);
                      const e = (ev.end?.dateTime as string) || (ev.end?.date ? `${ev.end.date}T00:00:00Z` : undefined);
                      return s && e ? { start: s, end: e } : null;
                    })
                    .filter(Boolean) as { start: string; end: string }[];
                } catch (err) {
                  console.error("Failed to load holiday calendar events", err);
                  return [] as { start: string; end: string }[];
                }
              })
            );
            gcalEvents.push(...holidayEventsArrays.flat());
          }
        } catch (err) {
          console.error("Failed to load holiday calendars", err);
        }
      }
    } catch (err) {
      console.error("Failed to load Google events", err);
    }
  }

  const duration = context.duration_minutes || 30;
  const bufferBefore = context.buffer_before || 0;
  const bufferAfter = context.buffer_after || 0;

  const spans: { start: Date; end: Date }[] = [];
  for (const row of blocks || []) {
    spans.push({ start: new Date(row.start_time as string), end: new Date(row.end_time as string) });
  }
  for (const row of bookings || []) {
    spans.push({ start: new Date(row.start_time as string), end: new Date(row.end_time as string) });
  }
  for (const row of gcalEvents) {
    spans.push({ start: new Date(row.start), end: new Date(row.end) });
  }

  const slots = new Set<string>();
  for (const w of windows) {
    const startStr = String(w.start_time).slice(0, 5);
    const endStr = String(w.end_time).slice(0, 5);
    const [sh, sm] = startStr.split(":").map(Number);
    const [eh, em] = endStr.split(":").map(Number);
    const windowStart = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), dayStart.getUTCDate(), sh, sm || 0));
    const windowEnd = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), dayStart.getUTCDate(), eh, em || 0));

    for (let cursor = new Date(windowStart); cursor.getTime() + duration * 60000 <= windowEnd.getTime(); cursor = new Date(cursor.getTime() + FIFTEEN_MINUTES)) {
      const start = new Date(cursor.getTime() + bufferBefore * 60000);
      const end = new Date(start.getTime() + duration * 60000);
      const endWithBuffer = new Date(end.getTime() + bufferAfter * 60000);
      if (start < minStart) continue;
      if (endWithBuffer > windowEnd) continue;
      const overlaps = spans.some((span) => start < span.end && endWithBuffer > span.start);
      if (!overlaps) {
        slots.add(toIsoFloorSeconds(start));
      }
    }
  }

  return slots;
}

export async function hostHasConflict(hostId: string, startIso: string, endIso: string): Promise<boolean> {
  const { data: bookingConflict } = await supabase
    .from("bookings")
    .select("id")
    .eq("user_id", hostId)
    .lt("start_time", endIso)
    .gt("end_time", startIso)
    .limit(1);

  if (bookingConflict && bookingConflict.length > 0) {
    return true;
  }

  const { data: blockConflict } = await supabase
    .from("blocks")
    .select("id")
    .eq("user_id", hostId)
    .lt("start_time", endIso)
    .gt("end_time", startIso)
    .limit(1);

  return !!(blockConflict && blockConflict.length > 0);
}
