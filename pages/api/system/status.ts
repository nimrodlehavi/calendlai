import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  res.status(200).json({ hasServiceRole });
}

