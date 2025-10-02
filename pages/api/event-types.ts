import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServerClient as supabase } from "../../lib/supabaseClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { id } = req.query as { id?: string };
    if (id) {
      const { data, error } = await supabase
        .from("event_types")
        .select("*")
        .eq("id", id)
        .single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ eventType: data });
    }
    const { data, error } = await supabase.from("event_types").select("*");
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ eventTypes: data });
  }

  if (req.method === "POST") {
    const { name, duration_minutes, userEmail } = req.body;

    // 👇 find the user by email
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", userEmail)
      .single();

    if (userError || !user) {
      return res.status(400).json({ error: "User not found" });
    }

    // 👇 create event type tied to that user
    const { data, error } = await supabase
      .from("event_types")
      .insert([{ name, duration_minutes, user_id: user.id }])
      .select();

    if (error) return res.status(400).json({ error });
    return res.status(200).json({ eventTypes: data });
  }

  if (req.method === "PUT") {
    const { id, name, duration_minutes } = req.body;
    const { data, error } = await supabase
      .from("event_types")
      .update({ name, duration_minutes })
      .eq("id", id)
      .select();

    if (error) return res.status(400).json({ error });
    return res.status(200).json({ eventType: data[0] });
  }

  if (req.method === "DELETE") {
    const { id } = req.body;
    const { error } = await supabase.from("event_types").delete().eq("id", id);
    if (error) return res.status(400).json({ error });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
