import { supabase } from "../lib/supabase";

export default async function handler(req: any, res: any) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const { data: users } = await supabase.from("users").select("username");
  const { data: events } = await supabase.from("event_types").select("owner_username, slug");

  let urls = [`<url><loc>${base}</loc></url>`];

  users?.forEach(u => {
    urls.push(`<url><loc>${base}/${u.username}</loc></url>`);
  });

  events?.forEach(e => {
    urls.push(`<url><loc>${base}/${e.owner_username}/${e.slug}</loc></url>`);
  });

  res.setHeader("Content-Type", "application/xml");
  res.send(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
}
