// pages/event-types.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AuthGuard from "../components/AuthGuard";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";
import Layout from "../components/Layout";
import { useSupabaseSession } from "../hooks/useSupabaseSession";
import { getAppOrigin } from "../lib/appOrigin";

type EventType = {
  id: string;
  user_id: string;
  name: string;
  duration_minutes: number;
  slug: string;
  description: string | null;
  is_public: boolean;
  scheduling_mode: string;
  created_at?: string;
};

export default function EventTypesPage() {
  return (
    <AuthGuard redirectTo="/login">
      <Content />
    </AuthGuard>
  );
}

const defaultForm = { name: "", duration_minutes: 30, buffer_before: 0, buffer_after: 0, min_notice_minutes: 60 };

function slugify(value: string) {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `event-${Date.now()}`;
}

function Content() {
  const { session, status, error: sessionError } = useSupabaseSession();
  const [items, setItems] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...defaultForm });
  const [err, setErr] = useState<string | null>(null);
  const [ownerUsername, setOwnerUsername] = useState<string>("");

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const profileRes = await supabaseBrowserClient
          .from('users')
          .select('username')
          .eq('id', session.user.id)
          .maybeSingle();
        if (!cancelled && profileRes.data?.username) {
          setOwnerUsername(profileRes.data.username);
        }
        if (profileRes.error) {
          console.warn('Profile lookup failed', profileRes.error);
        }

        const { data, error } = await supabaseBrowserClient
          .from("event_types")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (cancelled) return;

        if (error) {
          setErr(error.message);
          setItems([]);
          return;
        }

        setItems((data as EventType[]) ?? []);
      } catch (loadError: any) {
        if (!cancelled) {
          setErr(loadError?.message || 'Failed to load event types');
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

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    setErr(null);
    const slug = slugify(form.name);
    const payload = {
      user_id: session.user.id,
      name: form.name.trim(),
      duration_minutes: Number(form.duration_minutes) || 30,
      buffer_before: Number(form.buffer_before) || 0,
      buffer_after: Number(form.buffer_after) || 0,
      min_notice_minutes: Number(form.min_notice_minutes) || 60,
      slug,
      is_public: true,
    };
    const { data, error } = await supabaseBrowserClient
      .from("event_types")
      .insert(payload)
      .select("*")
      .single();
    if (error) return setErr(error.message);
    setItems([data as EventType, ...items]);
    setForm({ ...defaultForm });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">Event types</h1>
            <p className="text-sm text-slate-300">Craft curated booking flows for every moment.</p>
          </div>
          <span className="text-xs font-medium text-slate-300">
            {items.length} event type{items.length === 1 ? '' : 's'}
          </span>
        </header>

      <section className="rounded-2xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <p className="text-sm font-semibold text-slate-200">Your event types</p>
          <span className="text-xs text-slate-400">Instant share links</span>
        </div>
        {loading ? (
          <div className="space-y-4 px-5 py-6 text-sm text-slate-400">
            <div className="h-2 w-full animate-pulse rounded-full bg-white/10" />
            <div className="h-2 w-3/4 animate-pulse rounded-full bg-white/10" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-400">No event types yet.</div>
        ) : (
          <ul className="divide-y divide-white/5 px-5">
            {items.map((it) => (
              <EventTypeRow
                key={it.id}
                item={it}
                ownerUsername={ownerUsername}
                onDeleted={(id:string) => setItems(prev => prev.filter(p => p.id !== id))}
                onUpdated={(updated:any) => setItems(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Create new event type</h2>
        <form onSubmit={create} className="grid grid-cols-1 gap-4 md:grid-cols-5 md:items-end">
          <div>
            <label className="text-xs font-semibold text-slate-400">Name</label>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-accent-teal/80 focus:bg-white/10"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400">Duration (min)</label>
            <input
              type="number"
              min={5}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-accent-teal/80 focus:bg-white/10"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400">Buffer before</label>
            <input
              type="number"
              min={0}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-accent-teal/80 focus:bg-white/10"
              value={form.buffer_before}
              onChange={(e) => setForm({ ...form, buffer_before: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400">Buffer after</label>
            <input
              type="number"
              min={0}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-accent-teal/80 focus:bg-white/10"
              value={form.buffer_after}
              onChange={(e) => setForm({ ...form, buffer_after: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400">Min notice</label>
            <input
              type="number"
              min={0}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-accent-teal/80 focus:bg-white/10"
              value={form.min_notice_minutes}
              onChange={(e) => setForm({ ...form, min_notice_minutes: Number(e.target.value) })}
            />
          </div>
          <button className="rounded-full bg-accent-teal px-5 py-3 text-xs font-semibold text-slate-900 shadow-[0_15px_30px_rgba(54,214,214,0.35)] transition hover:bg-accent-teal/90">
            Create
          </button>
        </form>
        {err && <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{err}</div>}
        {sessionError && (
          <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {sessionError}
          </div>
        )}
      </section>
      </div>
    </Layout>
  );
}

function EventTypeRow({ item, ownerUsername, onDeleted, onUpdated }: { item: any; ownerUsername: string; onDeleted: (id: string)=>void; onUpdated: (updated: any)=>void }){
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState({
    name: item.name,
    duration_minutes: item.duration_minutes,
    buffer_before: item.buffer_before || 0,
    buffer_after: item.buffer_after || 0,
    min_notice_minutes: item.min_notice_minutes || 60,
    slug: item.slug || "",
    description: item.description || "",
    is_public: item.is_public !== false,
    scheduling_mode: item.scheduling_mode || "solo",
  });

  const [preview, setPreview] = useState<{ date: string; slots: number }[]>([]);
  const [hosts, setHosts] = useState<{ user_id: string; email: string | null; display_name: string | null; username: string | null; priority: number }[]>([]);
  const [hostsLoading, setHostsLoading] = useState(false);
  const [hostEmail, setHostEmail] = useState("");
  const [hostError, setHostError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareInviteUrl, setShareInviteUrl] = useState<string | null>(null);
  const [shareSending, setShareSending] = useState(false);
  const [shareAvailability, setShareAvailability] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [shareAvailabilityDate, setShareAvailabilityDate] = useState<string | null>(null);
  const baseUrl = getAppOrigin();
  const sharePath = ownerUsername && local.slug
    ? `/${ownerUsername}/${local.slug}`
    : `/book/${item.id}`;
  const shareUrl = baseUrl ? `${baseUrl}${sharePath}` : sharePath;

  useEffect(() => {
    if (!shareOpen) {
      setShareEmail('');
      setShareStatus(null);
      setShareSending(false);
      setShareInviteUrl(null);
      setShareAvailability(prev => (prev === 'available' ? prev : 'idle'));
      setShareAvailabilityDate(null);
    }
  }, [shareOpen]);

  async function ensureShareAvailability() {
    if (shareAvailability === 'available') {
      return true;
    }
    if (!item.id) return false;
    try {
      setShareAvailability('checking');
      setShareStatus(null);
      const res = await fetch(`/api/event-types/availability-check?event_type_id=${encodeURIComponent(item.id)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Unable to verify availability');
      }
      if (json.available) {
        setShareAvailability('available');
        setShareAvailabilityDate(json.next_available_date || null);
        return true;
      }
      setShareAvailability('unavailable');
      setShareAvailabilityDate(null);
      setShareStatus('No upcoming availability. Update your availability to share this event.');
      return false;
    } catch (err: any) {
      setShareAvailability('unavailable');
      setShareAvailabilityDate(null);
      setShareStatus(err.message || String(err));
      return false;
    }
  }

  async function save(){
    setSaving(true);
    const slugInput = local.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const finalSlug = slugInput || local.slug || item.slug;
    const payload = {
      ...local,
      slug: finalSlug,
      description: local.description?.trim() || null,
      is_public: !!local.is_public,
      scheduling_mode: local.scheduling_mode || 'solo',
    };
    const { error } = await supabaseBrowserClient
      .from('event_types')
      .update(payload)
      .eq('id', item.id);
    setSaving(false);
    if (error) alert(error.message);
    else {
      setLocal(prev => ({ ...prev, slug: finalSlug }));
      onUpdated({ id: item.id, ...payload });
    }
  }

  async function doDelete(){
    const ok = typeof window !== 'undefined' ? window.confirm('Delete this event type? This cannot be undone.') : false;
    if (!ok) return;
    const { error } = await supabaseBrowserClient.from('event_types').delete().eq('id', item.id);
    if (error) return alert(error.message);
    onDeleted(item.id);
  }

  async function loadPreview(){
    // next 7 days slots count
    const days: { date: string; slots: number }[] = [];
    for (let i=0;i<7;i++){
      const d = new Date(); d.setDate(d.getDate()+i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      // fetch slots
      const res = await fetch(`/api/slots?event_type_id=${encodeURIComponent(item.id)}&date=${encodeURIComponent(ymd)}`);
      const data = await res.json();
      const count = Array.isArray(data.slots) ? data.slots.length : 0;
      days.push({ date: ymd, slots: count });
    }
    setPreview(days);
  }

  async function loadHosts(){
    setHostsLoading(true);
    setHostError(null);
    try {
      const { data: session } = await supabaseBrowserClient.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(`/api/event-type-hosts?event_type_id=${encodeURIComponent(item.id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('Failed to load hosts');
      const json = await res.json();
      setHosts((json.hosts || []).map((h:any) => ({
        user_id: h.user_id,
        email: h.email ?? null,
        display_name: h.display_name ?? null,
        username: h.username ?? null,
        priority: h.priority ?? 0,
      })));
    } catch (err: any) {
      setHostError(err.message || String(err));
      setHosts([]);
    } finally {
      setHostsLoading(false);
    }
  }

  async function addHost(){
    if (!hostEmail.trim()) return;
    setHostError(null);
    try {
      const { data: session } = await supabaseBrowserClient.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch('/api/event-type-hosts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ event_type_id: item.id, email: hostEmail.trim() }),
      });
      const json = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(json.error || 'Failed to add host');
      if (json.host) {
        setHosts(prev => {
          const exists = prev.some(h => h.user_id === json.host.user_id);
          if (exists) return prev;
          return [...prev, { ...json.host, priority: json.host.priority ?? 0 }];
        });
      }
      setHostEmail('');
    } catch (err: any) {
      setHostError(err.message || String(err));
    }
  }

  async function removeHost(userId: string){
    setHostError(null);
    try {
      const { data: session } = await supabaseBrowserClient.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch('/api/event-type-hosts', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ event_type_id: item.id, user_id: userId }),
      });
      const json = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(json.error || 'Failed to remove host');
      setHosts(prev => prev.filter(h => h.user_id !== userId));
    } catch (err: any) {
      setHostError(err.message || String(err));
    }
  }

  async function sendShareInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!shareEmail.trim()) return;
    setShareSending(true);
    setShareStatus('Sending…');
    try {
      const { data: session } = await supabaseBrowserClient.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Sign in to share');
      const res = await fetch('/api/event-types/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          event_type_id: item.id,
          invitee_email: shareEmail.trim(),
          share_url: shareUrl,
          event_name: local.name,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.error === 'NO_AVAILABILITY') {
          setShareStatus('Set your availability before sharing this link. Redirecting…');
          setTimeout(() => router.push('/availability'), 500);
          return;
        }
        throw new Error(json.error || 'Failed to send invite');
      }
      setShareInviteUrl(json.invite_url || null);
      setShareStatus('Invite sent!');
      setShareEmail('');
    } catch (err: any) {
      setShareStatus(err.message || String(err));
    } finally {
      setShareSending(false);
    }
  }

  async function copyShareLink() {
    try {
      const ok = await ensureShareAvailability();
      if (!ok) {
        setShareOpen(true);
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus('Link copied to clipboard');
      } else {
        setShareStatus('Copy not supported');
      }
      setShareOpen(true);
    } catch {
      setShareStatus('Copy failed');
    }
  }

  return (
    <li className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-100">{local.name}</div>
          <div className="text-xs text-slate-400">{local.duration_minutes} min • buffer {local.buffer_before}/{local.buffer_after} min • notice {local.min_notice_minutes} min</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={`${shareOpen ? 'btn-primary' : 'btn-secondary'} px-4 py-2 text-xs`}
            onClick={async () => {
              if (!shareOpen) {
                const ok = await ensureShareAvailability();
                setShareOpen(true);
                setExpanded(false);
                if (!ok) return;
              } else {
                setShareOpen(false);
              }
            }}
          >
            {shareOpen ? 'Sharing' : 'Share'}
          </button>
          <button
            className="btn-secondary px-4 py-2 text-xs"
            onClick={copyShareLink}
          >
            Copy link
          </button>
          <button
            onClick={() => {
              const next = !expanded;
              setExpanded(next);
              if (next) {
                loadPreview();
                loadHosts();
              }
              if (next) setShareOpen(false);
            }}
            className={`${expanded ? 'btn-primary' : 'btn-secondary'} px-4 py-2 text-xs`}
          >
            {expanded ? 'Close' : 'Edit'}
          </button>
          <button onClick={doDelete} className="btn-danger px-4 py-2 text-xs">Delete</button>
        </div>
      </div>
      {shareOpen && (
        <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium text-slate-100">Share {local.name}</div>
          {shareAvailability === 'checking' && (
            <div className="text-xs text-slate-300">Checking your availability…</div>
          )}
          {shareAvailability === 'available' && shareAvailabilityDate && (
            <div className="rounded-2xl border border-accent-teal/30 bg-accent-teal/12 px-4 py-3 text-xs text-accent-teal">
              Next available slot: {new Date(shareAvailabilityDate).toLocaleDateString()}
            </div>
          )}
          {shareAvailability === 'unavailable' ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                {shareStatus || 'No upcoming availability found. Add hours before sharing.'}
              </div>
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-xs"
                onClick={() => router.push('/availability')}
              >
                Go to availability
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-midnight-300/70 focus:bg-white/10"
                  value={shareUrl}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="btn-secondary px-4 py-2 text-xs"
                  onClick={copyShareLink}
                >
                  Copy link
                </button>
              </div>
              <form onSubmit={sendShareInvite} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label className="text-xs text-slate-400">Email the link</label>
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="invitee@example.com"
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-midnight-300/70 focus:bg-white/10"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary mt-3 px-4 py-2 text-xs font-semibold sm:mt-5"
                  disabled={shareSending}
                >
                  {shareSending ? 'Sending…' : 'Send invite'}
                </button>
              </form>
            </>
          )}
          {(shareStatus || shareInviteUrl) && shareAvailability !== 'unavailable' && (
            <div className="break-words text-xs text-slate-200/80">
              {shareStatus}
              {shareInviteUrl && (
                <div>
                  <a href={shareInviteUrl} className="text-midnight-200 underline" target="_blank" rel="noreferrer">
                    View invitation link
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {expanded && (
        <div className="mt-4 grid gap-4">
          <div className="grid items-end gap-3 md:grid-cols-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400">Name</label>
              <input className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-midnight-300/70 focus:bg-white/10" value={local.name} onChange={e=> setLocal({ ...local, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400">Duration (min)</label>
              <input type="number" min={5} className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-midnight-300/70 focus:bg-white/10" value={local.duration_minutes} onChange={e=> setLocal({ ...local, duration_minutes: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400">Buffer before</label>
              <input type="number" min={0} className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-midnight-300/70 focus:bg-white/10" value={local.buffer_before} onChange={e=> setLocal({ ...local, buffer_before: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400">Buffer after</label>
              <input type="number" min={0} className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-midnight-300/70 focus:bg-white/10" value={local.buffer_after} onChange={e=> setLocal({ ...local, buffer_after: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400">Min notice</label>
              <input type="number" min={0} className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-midnight-300/70 focus:bg-white/10" value={local.min_notice_minutes} onChange={e=> setLocal({ ...local, min_notice_minutes: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid items-end gap-3 md:grid-cols-5">
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-400">Public link slug</label>
              <input
                className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-midnight-300/70 focus:bg-white/10"
                value={local.slug}
                onChange={e=> setLocal({ ...local, slug: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-2 pt-5">
              <input
                id={`public-${item.id}`}
                type="checkbox"
                checked={local.is_public}
                onChange={e=> setLocal({ ...local, is_public: e.target.checked })}
                className="h-4 w-4"
              />
              <label htmlFor={`public-${item.id}`} className="text-sm text-slate-200">Publicly visible</label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400">Description (optional)</label>
            <textarea
              className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-midnight-300/70 focus:bg-white/10"
              rows={3}
              value={local.description ?? ''}
              onChange={e=> setLocal({ ...local, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400">Scheduling mode</label>
            <select
              className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-midnight-300/70 focus:bg-white/10"
              value={local.scheduling_mode}
              onChange={e=> setLocal({ ...local, scheduling_mode: e.target.value as 'solo' | 'round_robin' })}
            >
              <option value="solo">Solo (only me)</option>
              <option value="round_robin">Round robin (rotate between hosts)</option>
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Round robin automatically assigns the time to the available host with the lightest upcoming load.
            </p>
          </div>
          <div>
            <button onClick={save} className="btn-primary px-5 py-2 text-xs" disabled={saving}>{saving? 'Saving…':'Save'}</button>
          </div>
          <div className="border-t pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-100">Team hosts</h4>
              {hostsLoading && <span className="text-xs text-slate-400">Loading…</span>}
            </div>
            {hostError && <div className="mb-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{hostError}</div>}
            <ul className="space-y-2">
              {hosts.map((host) => (
                <li key={host.user_id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100">
                  <div>
                    <div className="font-medium text-slate-100">{host.display_name || host.email || host.username || host.user_id.slice(0,8)}</div>
                    <div className="text-xs text-slate-400">
                      {host.email || host.username || host.user_id}
                      {host.user_id === item.user_id && ' • Owner'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-danger px-4 py-2 text-xs"
                    disabled={host.user_id === item.user_id}
                    onClick={() => removeHost(host.user_id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
              {hosts.length === 0 && !hostsLoading && (
                <li className="text-xs text-slate-400">Only you are hosting this event.</li>
              )}
            </ul>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                placeholder="host@company.com"
                value={hostEmail}
                onChange={e=> setHostEmail(e.target.value)}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-midnight-300/70 focus:bg-white/10"
              />
              <button type="button" className="btn-secondary px-4 py-2 text-xs" onClick={addHost}>
                Add host
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Hosts need a CalendlAI account. We&rsquo;ll invite them via email once added.
            </p>
          </div>
          <div className="text-sm text-slate-200">Preview next 7 days</div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            {preview.map(p => (
              <div key={p.date} className={`rounded-2xl border border-white/10 p-2 ${p.slots>0? 'bg-white/6 text-slate-100':'opacity-60 text-slate-300'}`}>
                <div>{new Date(p.date).toLocaleDateString(undefined, { month:'short', day:'numeric' })}</div>
                <div className="font-semibold">{p.slots}</div>
                <div>slots</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </li>
  )
}
