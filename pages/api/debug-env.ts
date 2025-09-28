export default function handler(req, res) {
  res.json({
    SUPABASE_URL: process.env.SUPABASE_URL,
    hasKey: !!process.env.SUPABASE_ANON_KEY
  })
}
