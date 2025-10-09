import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "../../../lib/supabaseConfig";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;

  if (!token) return res.status(401).json({ error: "Missing Authorization token" });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return res.status(401).json({ error: "Invalid session" });

  const user = userRes.user;
  const email = user.email ?? null;

  // Upsert the profile row for this auth user
  const { error: upsertErr } = await supabase
    .from("users")
    .upsert({ id: user.id, email }, { onConflict: "id" });

  if (upsertErr) return res.status(400).json({ error: upsertErr.message });

  return res.status(200).json({ ok: true, id: user.id, email });
}
