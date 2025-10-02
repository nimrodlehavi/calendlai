import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServerClient as supabase } from "../../lib/supabaseClient";
import { createSupabaseServerClient } from "../../lib/supabaseClient";
import { supabaseServiceClient } from "../../lib/supabaseServiceClient";

async function requireUser(req: NextApiRequest) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const client = createSupabaseServerClient(token);
  const { data } = await client.auth.getUser();
  if (!data.user) return null;
  return { user: data.user, client };
}

async function canManageEvent(eventTypeId: string, userId: string) {
  const client = supabaseServiceClient ?? supabase;
  const { data: event } = await client
    .from("event_types")
    .select("user_id, team_id")
    .eq("id", eventTypeId)
    .single();

  if (!event) return false;
  if (event.user_id === userId) return true;
  if (event.team_id) {
    const { data: tm } = await client
      .from("team_members")
      .select("role")
      .eq("team_id", event.team_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (tm && ["owner", "admin"].includes(tm.role)) return true;
  }
  return false;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseServiceClient) {
    return res.status(500).json({ error: "Service client unavailable" });
  }

  const authResult = await requireUser(req);
  if (!authResult) return res.status(401).json({ error: "Unauthorized" });
  const { user, client: authedClient } = authResult;

  const eventTypeId = (req.query.event_type_id as string) || req.body?.event_type_id;
  if (!eventTypeId) return res.status(400).json({ error: "Missing event_type_id" });

  const allowed = await canManageEvent(eventTypeId, user.id);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const { data, error } = await supabaseServiceClient
      .from("event_type_hosts")
      .select("user_id, priority, users:users!inner(id, email, display_name, username)")
      .eq("event_type_id", eventTypeId)
      .order("priority", { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    const hosts = (data || []).map((row: any) => ({
      user_id: row.user_id,
      priority: row.priority,
      email: row.users?.email ?? null,
      display_name: row.users?.display_name ?? null,
      username: row.users?.username ?? null,
    }));

    return res.status(200).json({ hosts });
  }

  if (req.method === "POST") {
    const { email, user_id, priority = 0 } = req.body as { email?: string; user_id?: string; priority?: number };
    let targetUserId = user_id || null;

    if (!targetUserId && email) {
      const { data: lookup } = await supabaseServiceClient
        .from("users")
        .select("id")
        .ilike("email", email.trim())
        .maybeSingle();
      if (!lookup) return res.status(404).json({ error: "User not found" });
      targetUserId = lookup.id;
    }

    if (!targetUserId) return res.status(400).json({ error: "Provide user_id or email" });

    const { error } = await authedClient
      .from("event_type_hosts")
      .insert({ event_type_id: eventTypeId, user_id: targetUserId, priority })
      .select()
      .single();

    if (error && !error.message?.includes("duplicate")) {
      return res.status(400).json({ error: error.message });
    }

    const { data: detail } = await supabaseServiceClient
      .from("users")
      .select("id, email, display_name, username")
      .eq("id", targetUserId)
      .single();

    return res.status(200).json({
      host: {
        user_id: targetUserId,
        priority,
        email: detail?.email ?? null,
        display_name: detail?.display_name ?? null,
        username: detail?.username ?? null,
      },
    });
  }

  if (req.method === "DELETE") {
    const { user_id: removeId } = req.body as { user_id: string };
    if (!removeId) return res.status(400).json({ error: "Missing user_id" });

    const { data: event } = await supabase
      .from("event_types")
      .select("user_id")
      .eq("id", eventTypeId)
      .single();
    if (event?.user_id === removeId) {
      return res.status(400).json({ error: "Cannot remove event owner" });
    }

    const { error } = await authedClient
      .from("event_type_hosts")
      .delete()
      .eq("event_type_id", eventTypeId)
      .eq("user_id", removeId);

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
