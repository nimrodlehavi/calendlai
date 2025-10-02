import type { NextApiRequest, NextApiResponse } from "next";

async function lookupGeo(ip?: string | null) {
  try {
    const resp = await fetch("https://ipapi.co/json/");
    if (!resp.ok) throw new Error("geo lookup failed");
    const data = await resp.json();
    return {
      city: data?.city ?? null,
      region: data?.region ?? data?.region_name ?? null,
      country: data?.country_name ?? data?.country ?? null,
      ip: data?.ip ?? ip ?? null,
    };
  } catch (error) {
    const city = null;
    const region = null;
    const country = null;
    return { city, region, country, ip: ip ?? null };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded
    ? forwarded.split(",")[0].trim()
    : req.socket.remoteAddress ?? null;

  const data = await lookupGeo(ip);
  return res.status(200).json(data);
}
