// pages/login.tsx
import Head from "next/head";
import AuthButtons from "../components/AuthButtons";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSupabaseSession } from "../hooks/useSupabaseSession";
import { buildRedirectUrl } from "../lib/appOrigin";

export default function LoginPage() {
  const router = useRouter();
  const { status, error: sessionError } = useSupabaseSession();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/event-types");
    }
  }, [status, router]);

  const sendMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: buildRedirectUrl('/') }),
      });
      const j = await r.json().catch(() => ({}));
      setBusy(false);
      if (!r.ok) setErr(j.error || 'Failed to send link');
      else setSent(true);
    } catch (e: any) {
      setBusy(false);
      setErr(String(e.message || e));
    }
  };

  return (
    <>
      <Head>
        <title>Sign in</title>
      </Head>
      <main className="relative grid min-h-[70vh] place-items-center px-6 py-12">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/90" />
        <div className="absolute inset-y-12 inset-x-16 -z-20 rounded-3xl bg-gradient-ai opacity-60" />
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/70 p-10 shadow-floating backdrop-blur-xl">
          <div className="mb-8 space-y-3 text-slate-100">
            <span className="text-xs font-medium text-slate-300">Secure access</span>
            <h1 className="text-3xl font-semibold">Welcome back to CalendlAI</h1>
            <p className="text-sm text-slate-300">
              Sign in to orchestrate availability, automate follow-ups, and let the AI co-pilot keep calendars in harmony.
            </p>
          </div>

          {status === "loading" && (
            <div className="mb-6 flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs uppercase tracking-[0.3em] text-slate-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent-teal" />
              Checking session…
            </div>
          )}
          {sessionError && (
            <div className="mb-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {sessionError}
            </div>
          )}

          <form onSubmit={sendMagic} className="flex flex-col gap-4">
            <label className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Magic link</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-accent-teal/80 focus:bg-white/10"
              placeholder="you@company.com"
            />
            {err && <div className="text-xs text-rose-400">{err}</div>}
            {sent ? (
              <div className="rounded-xl border border-accent-teal/40 bg-accent-teal/10 px-4 py-3 text-sm text-accent-teal">
                Magic link sent. Check your inbox.
              </div>
            ) : (
              <button
                type="submit"
                className="btn-primary px-6"
                disabled={busy}
              >
                {busy ? "Sending…" : "Email me a link"}
              </button>
            )}
          </form>

          <div className="my-6 flex items-center gap-3 text-slate-400">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] uppercase tracking-[0.35em]">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <AuthButtons />
        </div>
      </main>
    </>
  );
}
