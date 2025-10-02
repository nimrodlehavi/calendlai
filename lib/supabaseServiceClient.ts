import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

if (!serviceRole) {
  // Only warn in server context; do not crash builds.
  console.warn("SUPABASE_SERVICE_ROLE_KEY not set. Server-side privileged queries disabled.");
}

export const supabaseServiceClient = serviceRole
  ? createClient(url, serviceRole, { auth: { persistSession: false } })
  : null;

