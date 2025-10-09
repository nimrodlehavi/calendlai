import type { NextApiRequest, NextApiResponse } from "next";
import {
  fetchEventTypeContext,
  computeSlotsForDate,
} from "../../../lib/scheduling";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const eventTypeId = req.query.event_type_id?.toString();
  if (!eventTypeId) {
    return res.status(400).json({ error: "Missing event_type_id" });
  }

  try {
    const context = await fetchEventTypeContext(eventTypeId);
    const today = new Date();

    for (let i = 0; i < 30; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const slots = await computeSlotsForDate(
        context.eventType,
        context.hostIds,
        ymd,
        { hostPreferences: context.hostPreferences },
      );
      if (slots.length > 0) {
        return res.status(200).json({ available: true, next_available_date: ymd, slot_count: slots.length });
      }
    }

    return res.status(200).json({ available: false });
  } catch (error: any) {
    console.error("availability-check error", error);
    return res.status(500).json({ error: error?.message || "Internal error" });
  }
}
