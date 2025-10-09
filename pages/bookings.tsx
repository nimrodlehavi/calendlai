// pages/bookings.tsx
import { useEffect, useState } from "react";
import { Toast } from "../components/Toast";
import AuthGuard from "../components/AuthGuard";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";
import Layout from "../components/Layout";
import { useSupabaseSession } from "../hooks/useSupabaseSession";

type Booking = {
  id: string;
  user_id: string;
  event_type_id?: string | null;
  invitee_email?: string | null;
  invitee_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: string | null;
  created_at?: string;
  manage_token?: string | null;
};

export default function BookingsPage() {
  return (
    <AuthGuard redirectTo="/login">
      <Content />
    </AuthGuard>
  );
}

function Content() {
  const { session, status, error: sessionError } = useSupabaseSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error'|'info' } | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await supabaseBrowserClient
          .from("bookings")
          .select("*")
          .eq("user_id", session.user.id)
          .order("start_time", { ascending: false });

        if (cancelled) return;

        if (error) {
          setErr(error.message);
          setBookings([]);
          return;
        }

        setBookings((data as Booking[]) ?? []);
      } catch (loadError: any) {
        if (!cancelled) {
          setErr(loadError?.message || 'Failed to load bookings');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [session, status]);

  async function cancelBooking(id: string) {
    const ok = typeof window !== "undefined" ? window.confirm('Cancel this booking?') : false;
    if (!ok) return;
    if (!session?.access_token) {
      setToast({ msg: 'Session expired. Please sign in again.', type: 'error' });
      await supabaseBrowserClient.auth.signOut();
      return;
    }
    try {
      const r = await fetch('/api/bookings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, access_token: session.access_token })
      });
      if (!r.ok) {
        let message = 'Failed to cancel';
        try {
          const payload = await r.json();
          if (payload?.error) {
            message = typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error);
          }
        } catch (parseErr) {
          console.warn('Failed to parse cancel response', parseErr);
        }
        throw new Error(message);
      }
      setBookings(prev => prev.filter(b => b.id !== id));
      setToast({ msg: 'Booking cancelled', type: 'success' });
    } catch (e: any) {
      const msg = (e?.message ? String(e.message) : String(e));
      setToast({ msg, type: 'error' });
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">Bookings</h1>
            <p className="text-sm text-slate-300">Monitor meetings, reschedule with AI assistance, and keep calendars in sync.</p>
          </div>
          <div className="text-xs font-medium text-slate-400">
            {bookings.length} active booking{bookings.length === 1 ? '' : 's'}
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <p className="text-sm font-semibold text-slate-200">Your recent bookings</p>
            <span className="text-xs text-slate-400">Updates in real time</span>
          </div>
          {loading ? (
            <div className="space-y-4 py-6 text-sm text-slate-400">
              <div className="h-2 w-full animate-pulse rounded-full bg-white/10" />
              <div className="h-2 w-3/4 animate-pulse rounded-full bg-white/10" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">No bookings yet.</div>
          ) : (
            <ul className="divide-y divide-white/5">
              {bookings.map((b) => (
                <li key={b.id} className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-slate-50">
                      {b.invitee_name?.trim() || b.invitee_email || 'Invitee'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {fmt(b.start_time)}
                      {b.end_time ? ` – ${fmt(b.end_time)}` : ''} • {b.status ?? 'confirmed'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {b.manage_token ? (
                      <a
                        href={`/manage/${b.manage_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary px-4 py-2 text-xs"
                      >
                        Reschedule
                      </a>
                    ) : (
                      <button className="btn-ghost px-4 py-2 text-xs opacity-60" title="No manage link for this booking" disabled>
                        Reschedule
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        const ok = typeof window !== 'undefined' ? window.confirm('Ask invitee to reschedule? This frees the time slot.') : false;
                        if (!ok) return;
                        try {
                          const r = await fetch('/api/bookings/request-reschedule', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: b.id }),
                          });
                          if (!r.ok) throw new Error((await r.json()).error || 'Failed to request reschedule');
                          setBookings((prev) => prev.filter((x) => x.id !== b.id));
                          setToast({ msg: 'Reschedule request sent', type: 'success' });
                        } catch (e: any) {
                          setToast({ msg: String(e.message || e), type: 'error' });
                        }
                      }}
                      className="btn-secondary px-4 py-2 text-xs"
                    >
                      Ask to reschedule
                    </button>
                    <button onClick={() => cancelBooking(b.id)} className="btn-danger px-4 py-2 text-xs">
                      Cancel
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {err && <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{err}</div>}
          {sessionError && (
            <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {sessionError}
            </div>
          )}
        </section>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </Layout>
  );
}

function fmt(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso ?? "—";
  }
}
