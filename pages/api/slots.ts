import type { NextApiRequest, NextApiResponse } from "next";
import { fetchEventTypeContext, computeSlotsForDate } from "../../lib/scheduling";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { event_type_id, date } = req.query as { event_type_id?: string; date?: string };
  if (!event_type_id || !date) return res.status(400).json({ error: 'Missing event_type_id or date' });

  try {
    const { eventType, hostIds, hostPreferences } = await fetchEventTypeContext(event_type_id);
    const slots = await computeSlotsForDate(eventType, hostIds, date, { hostPreferences });
    if (process.env.NODE_ENV === 'development') {
      console.log('[slots] event', event_type_id, 'hosts', hostIds, 'slots', slots.length);
    }
    return res.status(200).json({ slots });
  } catch (error: any) {
    console.error('[slots] error', error);
    return res.status(400).json({ error: String(error.message || error) });
  }
}
