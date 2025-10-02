// pages/bookings.tsx
import { useEffect, useState } from "react";
import { Toast } from "../components/Toast";
import AuthGuard from "../components/AuthGuard";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";
import type { Session } from "@supabase/supabase-js";

type Booking = {
  id: string;
  user_id: string;
  event_type_id?: string | null;
  invitee_email?: string | null;
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
  const [session, setSession] = useState<Session | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error'|'info' } | null>(null);

  useEffect(() => {
    supabaseBrowserClient.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    const load = async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabaseBrowserClient
        .from("bookings")
        .select("*")
        .eq("user_id", session.user.id)
        .order("start_time", { ascending: false });
      if (error) setErr(error.message);
      setBookings((data as Booking[]) ?? []);
      setLoading(false);
    };
    load();
  }, [session]);

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
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Bookings</h1>

      <section className="rounded-xl border">
        <div className="p-4 border-b font-medium">Your recent bookings</div>
        {loading ? (
          <div className="p-4 text-sm text-gray-600">Loading…</div>
        ) : bookings.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No bookings yet.</div>
        ) : (
          <ul className="divide-y">
            {bookings.map((b) => (
              <li key={b.id} className="p-4 grid gap-2 md:flex md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{b.invitee_email ?? "Invitee"}</div>
                  <div className="text-sm text-gray-600">{fmt(b.start_time)}{b.end_time ? ` – ${fmt(b.end_time)}` : ""} • {b.status ?? "confirmed"}</div>
                </div>
                <div className="flex gap-2">
                  {b.manage_token ? (
                    <a href={`/manage/${b.manage_token}`} target="_blank" rel="noreferrer" className="px-3 py-1 rounded border">Reschedule</a>
                  ) : (
                    <button className="px-3 py-1 rounded border opacity-60 cursor-not-allowed" title="No manage link for this booking">Reschedule</button>
                  )}
                  <button
                    onClick={async ()=> {
                      const ok = typeof window !== 'undefined' ? window.confirm('Ask invitee to reschedule? This frees the time slot.') : false;
                      if (!ok) return;
                      try {
                        const r = await fetch('/api/bookings/request-reschedule', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ id: b.id }) });
                        if (!r.ok) throw new Error((await r.json()).error || 'Failed to request reschedule');
                        setBookings(prev => prev.filter(x => x.id !== b.id));
                        setToast({ msg: 'Reschedule request sent', type: 'success' });
                      } catch (e:any) { setToast({ msg: String(e.message||e), type:'error' }); }
                    }}
                    className="px-3 py-1 rounded border"
                  >Request reschedule</button>
                  <button onClick={() => cancelBooking(b.id)} className="px-3 py-1 rounded border border-red-600 text-red-700">Cancel</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {err && <div className="p-4 text-sm text-red-600">{err}</div>}
      </section>
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </main>
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
