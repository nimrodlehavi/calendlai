import type { NextApiRequest, NextApiResponse } from "next";
import { decodeInviteToken } from "../../../lib/inviteTokens";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.query.token;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Missing token" });
  }

  try {
    const email = decodeInviteToken(token);
    return res.status(200).json({ email });
  } catch (err: any) {
    return res.status(400).json({ error: "Invalid token" });
  }
}
