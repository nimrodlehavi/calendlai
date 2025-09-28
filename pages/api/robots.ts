import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Content-Type", "text/plain");
  res.send(`User-agent: *
Allow: /
Sitemap: ${process.env.NEXT_PUBLIC_BASE_URL}/sitemap.xml`);
}
