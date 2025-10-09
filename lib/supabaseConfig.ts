function ensureValue(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required env var ${name}. Check your .env.local.`);
  }

  const trimmed = value.trim();
  const placeholderPatterns = [/YOUR[-_]?SUPABASE/i, /SUPABASE[._-]?URL/i, /SUPABASE[._-]?ANON/i];
  if (placeholderPatterns.some((pattern) => pattern.test(trimmed))) {
    throw new Error(`Env var ${name} still uses a placeholder. Replace it with the real Supabase value.`);
  }

  return trimmed;
}

export const supabaseUrl = ensureValue(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey = ensureValue(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
);

export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;

if (!supabaseServiceRoleKey && process.env.NODE_ENV === "development") {
  console.warn("SUPABASE_SERVICE_ROLE_KEY not set. Server-side admin APIs will be limited.");
}

if (!supabaseUrl.startsWith("https://")) {
  throw new Error("Supabase URL must start with https://");
}

if (supabaseAnonKey.split(".").length < 3) {
  throw new Error("Supabase anon key format looks incorrect");
}
