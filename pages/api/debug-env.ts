import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.json({
    SUPABASE_URL: process.env.SUPABASE_URL,
    hasKey: !!process.env.SUPABASE_ANON_KEY,
  });
}
