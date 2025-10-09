// lib/supabaseBrowserClient.ts
import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./supabaseConfig";

export const supabaseBrowserClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "calendlai-auth-token",
  },
});
