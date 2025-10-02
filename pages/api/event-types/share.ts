import type { NextApiRequest, NextApiResponse } from "next";
import { createSupabaseServerClient } from "../../../lib/supabaseClient";
import { sendBookingEmail } from "../../../lib/email";
import { createInviteToken } from "../../../lib/inviteTokens";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { event_type_id, invitee_email, share_url, event_name } = req.body as {
    event_type_id?: string;
    invitee_email?: string;
    share_url?: string;
    event_name?: string;
  };

  if (!event_type_id || !invitee_email || !share_url) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const authedClient = createSupabaseServerClient(token);
  const { data: authUser, error: authErr } = await authedClient.auth.getUser();
  if (authErr || !authUser?.user) return res.status(401).json({ error: "Invalid session" });
  const userId = authUser.user.id;

  const { data: event, error: eventError } = await authedClient
    .from("event_types")
    .select("name, user_id")
    .eq("id", event_type_id)
    .single();

  if (eventError || !event) {
    return res.status(404).json({ error: "Event type not found" });
  }

  if (event.user_id !== userId) {
    const { data: hostRow } = await authedClient
      .from("event_type_hosts")
      .select("user_id")
      .eq("event_type_id", event_type_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!hostRow) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  const { data: inviter } = await authedClient
    .from("users")
    .select("display_name, username")
    .eq("id", userId)
    .single();

  const hostName = inviter?.display_name || inviter?.username || "your host";
  let inviteUrl = share_url;
  try {
    const token = createInviteToken(invitee_email);
    if (token) {
      inviteUrl = `${share_url}${share_url.includes('?') ? '&' : '?'}invitee_token=${encodeURIComponent(token)}`;
    } else {
      console.warn("INVITE_LINK_SECRET not set; sending plain invite link");
    }
  } catch (err) {
    console.warn("Failed to generate invite token", err);
  }

  const subject = `${hostName} invited you to meet about ${event_name || event.name}`;
  const text = `Hi there,

${hostName} would love to meet with you for ${event_name || event.name}.

Pick a time that works for you:
${inviteUrl}

Looking forward to connecting!
— ${hostName} (via CalendlAI)`;

  try {
    await sendBookingEmail({
      to: invitee_email,
      subject,
      text,
      icsContent: "",
    });
  } catch (err: any) {
    return res.status(500).json({ error: String(err.message || err) });
  }

  return res.status(200).json({ ok: true, invite_url: inviteUrl });
}
