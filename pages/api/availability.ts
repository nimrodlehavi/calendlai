import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('availability_windows')
      .select('*')

    if (error) return res.status(400).json({ error })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { day_of_week, start_time, end_time } = req.body
    const { data, error } = await supabase
      .from('availability_windows')
      .insert([{ day_of_week, start_time, end_time }])

    if (error) return res.status(400).json({ error })
    return res.status(200).json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
