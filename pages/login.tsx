// pages/login.tsx
import Head from "next/head";
import AuthButtons from "../components/AuthButtons";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowserClient.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  const sendMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: `${location.origin}/` }),
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
      <Head><title>Sign in</title></Head>
      <main className="min-h-[70vh] grid place-items-center p-6">
        <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
          <h1 className="text-2xl font-bold mb-2">Welcome to CalendlAI</h1>
          <p className="text-sm text-gray-600 mb-4">Sign in to continue.</p>

          <form onSubmit={sendMagic} className="flex flex-col gap-2 mb-4">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border rounded-md px-3 py-2"
              placeholder="you@company.com"
            />
            {err && <div className="text-sm text-red-600">{err}</div>}
            {sent ? (
              <div className="rounded-md bg-green-50 text-green-900 text-sm p-3">
                Magic link sent. Check your inbox.
              </div>
            ) : (
              <button
                type="submit"
                className="rounded-md bg-black text-white px-3 py-2 disabled:opacity-60"
                disabled={busy}
              >
                {busy ? "Sending…" : "Send magic link"}
              </button>
            )}
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-xs text-gray-500">or</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          <AuthButtons />
        </div>
      </main>
    </>
  );
}
