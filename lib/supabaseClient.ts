import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Singleton without auth header
export const supabaseServerClient = createClient(url, anon, {
  auth: { persistSession: false },
});

// Per-request client supporting Authorization bearer token
export function createSupabaseServerClient(token?: string) {
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}
