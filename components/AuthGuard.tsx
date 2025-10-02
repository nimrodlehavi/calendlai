// components/AuthGuard.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";
import AuthButtons from "./AuthButtons";

type Props = {
  children: React.ReactNode;
  // Optional: if unauthenticated, send users here (defaults to inline prompt)
  redirectTo?: string | null;
};

export default function AuthGuard({ children, redirectTo = null }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | "loading">("loading");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const { data } = await supabaseBrowserClient.auth.getSession();
      if (!mounted) return;
      setSession(data.session ?? null);
    };
    run();

    const { data: sub } = supabaseBrowserClient.auth.onAuthStateChange((event, s) => {
      setSession(s ?? null);
      if (event === "SIGNED_IN" && router.pathname === "/login") {
        router.replace("/event-types");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (session === "loading") {
    return (
      <div className="min-h-[40vh] grid place-items-center text-gray-600">
        <div className="animate-pulse text-sm">Loading…</div>
      </div>
    );
  }

  if (!session) {
    if (redirectTo) {
      // Optional redirect mode (e.g., use <AuthGuard redirectTo="/login">)
      if (typeof window !== "undefined") router.replace(redirectTo);
      return null;
    }

    // Inline prompt mode: show sign-in UI in-place
    return (
      <div className="min-h-[60vh] grid place-items-center p-6">
        <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Sign in to continue</h2>
          <p className="text-sm text-gray-600 mb-4">
            Use email (magic link) or OAuth.
          </p>
          <InlineMagicLinkForm />
          <div className="my-4 flex items-center gap-3">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-xs text-gray-500">or</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>
          <AuthButtons />
        </div>
      </div>
    );
  }

  // Authenticated
  return <>{children}</>;
}

function InlineMagicLinkForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const r = await fetch('/api/auth/send-magic-link', {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ email, redirectTo: `${location.origin}/` })
      });
      const j = await r.json().catch(()=> ({}));
      setSending(false);
      if (!r.ok) setError(j.error || 'Failed to send link'); else setSent(true);
    } catch (e:any) { setSending(false); setError(String(e.message||e)); }
  };

  if (sent) {
    return (
      <div className="rounded-md bg-green-50 text-green-900 text-sm p-3">
        Magic link sent. Check your inbox.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="text-sm font-medium">Email</label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border rounded-md px-3 py-2"
        placeholder="you@company.com"
      />
      {error && <div className="text-sm text-red-600">{error}</div>}
      <button
        type="submit"
        disabled={sending}
        className="mt-1 rounded-md bg-black text-white px-3 py-2 disabled:opacity-60"
      >
        {sending ? "Sending…" : "Send magic link"}
      </button>
    </form>
  );
}
