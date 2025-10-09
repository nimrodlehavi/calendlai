import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./supabaseConfig";

// Singleton without auth header
export const supabaseServerClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

// Per-request client supporting Authorization bearer token
export function createSupabaseServerClient(token?: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}
