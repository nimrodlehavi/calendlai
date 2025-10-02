"use client";
import { useEffect, useState } from "react";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";

export default function UserGreeting() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: u } = await supabaseBrowserClient.auth.getUser();
      if (!mounted) return;
      if (!u.user) { setName(null); return; }
      // Prefer profile display_name, else user_metadata name, else email
      const { data: prof } = await supabaseBrowserClient
        .from('users')
        .select('display_name')
        .eq('id', u.user.id)
        .maybeSingle();
      const display = prof?.display_name || (u.user.user_metadata as any)?.name || u.user.email || null;
      setName(display);
    };
    load();
    const { data: sub } = supabaseBrowserClient.auth.onAuthStateChange((_e, s) => {
      if (!s?.user) { setName(null); return; }
      // re-run profile fetch quickly
      supabaseBrowserClient
        .from('users')
        .select('display_name')
        .eq('id', s.user.id)
        .maybeSingle()
        .then(({ data }) => {
          const display = data?.display_name || (s.user.user_metadata as any)?.name || s.user.email || null;
          setName(display);
        });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  if (!name) return null;
  return <span className="text-sm text-gray-700">Hi {name}</span>;
}

