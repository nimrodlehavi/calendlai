import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('event_types').select('*')
    if (error) return res.status(400).json({ error })
    return res.status(200).json({ eventTypes: data })
  }

  if (req.method === 'POST') {
    const { name, duration_minutes } = req.body
    const { data, error } = await supabase
      .from('event_types')
      .insert([{ name, duration_minutes }])
      .select()

    if (error) return res.status(400).json({ error })
    return res.status(200).json({ eventTypes: data })
  }

  if (req.method === "PUT") {
    const { id, name, duration_minutes } = req.body
    const { data, error } = await supabase
      .from("event_types")
      .update({ name, duration_minutes })
      .eq("id", id)
      .select()

    if (error) return res.status(400).json({ error })
    return res.status(200).json({ eventType: data[0] })
  }

  if (req.method === "DELETE") {
    const { id } = req.body
    const { error } = await supabase.from("event_types").delete().eq("id", id)
    if (error) return res.status(400).json({ error })
    return res.status(200).json({ success: true })
  }


  res.status(405).json({ error: 'Method not allowed' })
}
