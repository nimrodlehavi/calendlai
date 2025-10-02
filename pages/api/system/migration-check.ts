import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServiceClient } from '../../../lib/supabaseServiceClient';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const hasServiceRole = !!supabaseServiceClient;
  if (!hasServiceRole) {
    return res.status(200).json({ hasServiceRole: false, tables: { oauth_states: null, calendars: null } });
  }
  const tables: Record<string, boolean | null> = { oauth_states: null, calendars: null };
  try {
    const r1 = await supabaseServiceClient!.from('oauth_states').select('*', { head: true, count: 'exact' }).limit(1);
    tables.oauth_states = !r1.error;
  } catch {
    tables.oauth_states = false;
  }
  try {
    const r2 = await supabaseServiceClient!.from('calendars').select('*', { head: true, count: 'exact' }).limit(1);
    tables.calendars = !r2.error;
  } catch {
    tables.calendars = false;
  }
  return res.status(200).json({ hasServiceRole: true, tables });
}
