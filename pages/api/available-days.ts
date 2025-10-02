import type { NextApiRequest, NextApiResponse } from "next";
import { fetchEventTypeContext, computeSlotsForDate } from "../../lib/scheduling";

type CacheEntry = {
  expiresAt: number;
  days: string[];
};

const availabilityCache = new Map<string, CacheEntry>();

function ymd(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { event_type_id, month } = req.query as { event_type_id?: string; month?: string };
  if (!event_type_id || !month) return res.status(400).json({ error: 'Missing event_type_id or month' });

  // month is YYYY-MM
  const [yStr, mStr] = month.split('-');
  const year = Number(yStr), mon = Number(mStr) - 1;
  if (isNaN(year) || isNaN(mon)) return res.status(400).json({ error: 'Invalid month' });
  const monthStart = new Date(Date.UTC(year, mon, 1, 0, 0, 0));
  const nextMonth = new Date(Date.UTC(year, mon + 1, 1, 0, 0, 0));
  const monthEnd = new Date(nextMonth.getTime() - 1);

  const cacheKey = `${event_type_id}:${month}`;
  const cached = availabilityCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.status(200).json({ days: cached.days });
  }

  let context;
  try {
    context = await fetchEventTypeContext(event_type_id);
  } catch (error: any) {
    console.error('[available-days] fetchEventTypeContext error', error);
    return res.status(400).json({ error: String(error.message || error) });
  }

  const availableDays: string[] = [];
  for (let d = new Date(monthStart); d <= monthEnd; d = new Date(d.getTime() + 24*3600*1000)) {
    let slots: any[] = [];
    try {
      slots = await computeSlotsForDate(context.eventType, context.hostIds, ymd(d), {
        hostPreferences: context.hostPreferences,
      });
    } catch (error: any) {
      console.error('[available-days] computeSlots error', ymd(d), error);
      try {
        slots = await computeSlotsForDate(context.eventType, context.hostIds, ymd(d), {
          skipGoogle: true,
          hostPreferences: context.hostPreferences,
        });
      } catch (fallbackErr) {
        console.error('[available-days] fallback computeSlots error', ymd(d), fallbackErr);
        slots = [];
      }
    }

    if (slots.length > 0) {
      availableDays.push(ymd(d));
    }
  }

  availabilityCache.set(cacheKey, {
    expiresAt: Date.now() + 5 * 60 * 1000, // cache for 5 minutes
    days: availableDays,
  });

  return res.status(200).json({ days: availableDays });
}
