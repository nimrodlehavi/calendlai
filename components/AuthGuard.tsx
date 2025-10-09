// components/AuthGuard.tsx
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import AuthButtons from "./AuthButtons";
import { useSupabaseSession } from "../hooks/useSupabaseSession";
import { buildRedirectUrl } from "../lib/appOrigin";

type Props = {
  children: React.ReactNode;
  // Optional: if unauthenticated, send users here (defaults to inline prompt)
  redirectTo?: string | null;
};

export default function AuthGuard({ children, redirectTo = null }: Props) {
  const router = useRouter();
  const { session, status, error } = useSupabaseSession();
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (!redirectTo || status !== "unauthenticated" || redirectingRef.current) return;
    redirectingRef.current = true;
    if (typeof window !== "undefined") {
      router.replace(redirectTo);
    }
  }, [redirectTo, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-[40vh] grid place-items-center text-slate-300">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-semibold text-slate-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent-teal" />
          Verifying session
        </div>
      </div>
    );
  }

  if (status === "unauthenticated" || !session) {
    if (redirectTo) {
      // Optional redirect mode (e.g., use <AuthGuard redirectTo="/login">)
      return (
        <div className="min-h-[40vh] grid place-items-center text-slate-300">
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-semibold text-slate-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent-teal" />
            Redirecting to sign in…
          </div>
        </div>
      );
    }

    // Inline prompt mode: show sign-in UI in-place
    return (
      <div className="min-h-[60vh] grid place-items-center px-6 py-12">
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-floating backdrop-blur-xl">
          <h2 className="text-2xl font-semibold text-slate-50">Sign in to continue</h2>
          <p className="mt-2 text-sm text-slate-300">Use a magic link or connect with Google to sync calendars instantly.</p>
          {error && (
            <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}
          <InlineMagicLinkForm />
          <div className="my-6 flex items-center gap-3 text-slate-500">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-medium text-slate-400">or</span>
            <div className="h-px flex-1 bg-white/10" />
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
        body: JSON.stringify({ email, redirectTo: buildRedirectUrl('/') })
      });
      const j = await r.json().catch(()=> ({}));
      setSending(false);
      if (!r.ok) setError(j.error || 'Failed to send link'); else setSent(true);
    } catch (e:any) { setSending(false); setError(String(e.message||e)); }
  };

  if (sent) {
    return (
      <div className="mt-4 rounded-xl border border-accent-teal/40 bg-accent-teal/10 px-4 py-3 text-sm text-accent-teal">
        Magic link sent. Check your inbox.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-3 text-slate-200">
      <label className="text-xs font-semibold text-slate-400">Email</label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-accent-teal/80 focus:bg-white/10"
        placeholder="you@company.com"
      />
      {error && <div className="text-xs text-rose-300">{error}</div>}
      <button type="submit" disabled={sending} className="btn-primary mt-2 px-6">
        {sending ? "Sending…" : "Email me a link"}
      </button>
    </form>
  );
}
