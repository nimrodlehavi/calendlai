import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServerClient as supabase } from "../../lib/supabaseClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("availability").select("*");
    if (error) return res.status(400).json({ error });

    return res.status(200).json({ availability: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
