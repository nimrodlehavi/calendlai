"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

type SessionState = {
  status: SessionStatus;
  session: Session | null;
  error: string | null;
};

const initialState: SessionState = {
  status: "loading",
  session: null,
  error: null,
};

export function useSupabaseSession() {
  const [state, setState] = useState<SessionState>(initialState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const load = async () => {
      const { data, error } = await supabaseBrowserClient.auth.getSession();
      if (!mountedRef.current) return;
      if (error) {
        setState({ status: "unauthenticated", session: null, error: error.message });
        return;
      }
      const session = data.session ?? null;
      setState({
        status: session ? "authenticated" : "unauthenticated",
        session,
        error: null,
      });
    };

    load();

    const { data: subscription } = supabaseBrowserClient.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      setState({
        status: session ? "authenticated" : "unauthenticated",
        session: session ?? null,
        error: null,
      });
    });

    return () => {
      mountedRef.current = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
