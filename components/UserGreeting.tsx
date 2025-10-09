"use client";
import { useEffect, useState } from "react";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";
import { useSupabaseSession } from "../hooks/useSupabaseSession";

export default function UserGreeting() {
  const { session, status } = useSupabaseSession();
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      setName(null);
      return;
    }

    let cancelled = false;
    const fetchName = async () => {
      setLoading(true);
      try {
        const { data: prof, error } = await supabaseBrowserClient
          .from("users")
          .select("display_name")
          .eq("id", session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.warn("Failed to load profile display name", error);
        }
        const display = prof?.display_name || (session.user.user_metadata as any)?.name || session.user.email || null;
        setName(display);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchName();

    return () => {
      cancelled = true;
    };
  }, [session, status]);

  if (status !== "authenticated" || loading) return null;

  if (!name) return null;

  return (
    <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100 md:flex">
      <span className="h-2 w-2 rounded-full bg-accent-teal shadow-[0_0_12px_rgba(54,214,214,0.65)]" />
      Hi {name}
    </div>
  );
}
