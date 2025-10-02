// pages/event-types.tsx
import { useEffect, useState } from "react";
import AuthGuard from "../components/AuthGuard";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";
import type { Session } from "@supabase/supabase-js";

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

function Content() {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", duration_minutes: 30, buffer_before: 0, buffer_after: 0, min_notice_minutes: 60 });
  const [err, setErr] = useState<string | null>(null);
  const [ownerUsername, setOwnerUsername] = useState<string>("");

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
      const profileRes = await supabaseBrowserClient
        .from('users')
        .select('username')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profileRes.data?.username) setOwnerUsername(profileRes.data.username);
      const { data, error } = await supabaseBrowserClient
        .from("event_types")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (error) setErr(error.message);
      setItems((data as EventType[]) ?? []);
      setLoading(false);
    };
    load();
  }, [session]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setErr(null);
    const payload = {
      user_id: session.user.id,
      name: form.name.trim(),
      duration_minutes: Number(form.duration_minutes) || 30,
      buffer_before: Number(form.buffer_before) || 0,
      buffer_after: Number(form.buffer_after) || 0,
      min_notice_minutes: Number(form.min_notice_minutes) || 60,
    };
    const { data, error } = await supabaseBrowserClient
      .from("event_types")
      .insert(payload)
      .select("*")
      .single();
    if (error) return setErr(error.message);
    setItems([data as EventType, ...items]);
    setForm({ name: "", duration_minutes: 30, buffer_before: 0, buffer_after: 0, min_notice_minutes: 60 });
  };

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Event Types</h1>

      <section className="rounded-xl border">
        <div className="p-4 border-b font-medium">Your event types</div>
        {loading ? (
          <div className="p-4 text-sm text-gray-600">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No event types yet.</div>
        ) : (
          <ul className="divide-y">
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

      <section className="mt-8 rounded-xl border p-4">
        <h2 className="mb-3 text-lg font-semibold">Create new event type</h2>
        <form onSubmit={create} className="grid grid-cols-1 gap-3 md:grid-cols-5 md:items-end">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Duration (min)</label>
            <input
              type="number"
              min={5}
              className="w-full rounded-md border px-3 py-2"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Buffer before (min)</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-md border px-3 py-2"
              value={form.buffer_before}
              onChange={(e) => setForm({ ...form, buffer_before: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Buffer after (min)</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-md border px-3 py-2"
              value={form.buffer_after}
              onChange={(e) => setForm({ ...form, buffer_after: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Min notice (min)</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-md border px-3 py-2"
              value={form.min_notice_minutes}
              onChange={(e) => setForm({ ...form, min_notice_minutes: Number(e.target.value) })}
            />
          </div>
          <button className="rounded-md bg-black px-4 py-2 text-white">Create</button>
        </form>
        {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
      </section>
    </main>
  );
}

function EventTypeRow({ item, ownerUsername, onDeleted, onUpdated }: { item: any; ownerUsername: string; onDeleted: (id: string)=>void; onUpdated: (updated: any)=>void }){
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
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || '';
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
    }
  }, [shareOpen]);

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
      if (!res.ok) throw new Error(json.error || 'Failed to send invite');
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
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus('Link copied to clipboard');
      } else {
        setShareStatus('Copy not supported');
      }
    } catch {
      setShareStatus('Copy failed');
    }
  }

  return (
    <li className="p-4 border-b">
      <div className="flex justify-between items-center">
        <div>
          <div className="font-medium">{local.name}</div>
          <div className="text-sm text-gray-600">{local.duration_minutes} min • buffer {local.buffer_before}/{local.buffer_after} min • notice {local.min_notice_minutes} min</div>
        </div>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1 rounded border ${shareOpen ? 'border-blue-500 bg-blue-50 text-blue-700' : ''}`}
            onClick={() => {
              const next = !shareOpen;
              setShareOpen(next);
              if (next) setExpanded(false);
            }}
          >
            {shareOpen ? 'Sharing' : 'Share'}
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
            className={`px-3 py-1 rounded border ${expanded ? 'border-blue-500 bg-blue-50 text-blue-700' : ''}`}
          >
            {expanded ? 'Close' : 'Edit'}
          </button>
          <button onClick={doDelete} className="px-3 py-1 rounded border border-red-600 text-red-700">Delete</button>
        </div>
      </div>
      {shareOpen && (
        <div className="mt-3 grid gap-3 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
          <div className="text-sm font-medium text-blue-900">Share {local.name}</div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="w-full rounded border px-3 py-2 text-xs"
              value={shareUrl}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              className="rounded border border-blue-400 px-3 py-2 text-xs text-blue-700"
              onClick={copyShareLink}
            >
              Copy link
            </button>
          </div>
          <form onSubmit={sendShareInvite} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="text-xs text-gray-600">Email the link</label>
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="invitee@example.com"
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                required
              />
            </div>
            <button
              type="submit"
              className="mt-3 rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white sm:mt-5"
              disabled={shareSending}
            >
              {shareSending ? 'Sending…' : 'Send invite'}
            </button>
          </form>
          {(shareStatus || shareInviteUrl) && (
            <div className="text-xs text-blue-800 break-words">
              {shareStatus}
              {shareInviteUrl && (
                <div>
                  <a href={shareInviteUrl} className="underline text-blue-700" target="_blank" rel="noreferrer">
                    View invitation link
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {expanded && (
        <div className="mt-3 grid gap-3">
          <div className="grid md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Name</label>
              <input className="border rounded px-3 py-2 w-full" value={local.name} onChange={e=> setLocal({ ...local, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Duration (min)</label>
              <input type="number" min={5} className="border rounded px-3 py-2 w-full" value={local.duration_minutes} onChange={e=> setLocal({ ...local, duration_minutes: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Buffer before (min)</label>
              <input type="number" min={0} className="border rounded px-3 py-2 w-full" value={local.buffer_before} onChange={e=> setLocal({ ...local, buffer_before: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Buffer after (min)</label>
              <input type="number" min={0} className="border rounded px-3 py-2 w-full" value={local.buffer_after} onChange={e=> setLocal({ ...local, buffer_after: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Min notice (min)</label>
              <input type="number" min={0} className="border rounded px-3 py-2 w-full" value={local.min_notice_minutes} onChange={e=> setLocal({ ...local, min_notice_minutes: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid md:grid-cols-5 gap-3 items-end">
            <div className="md:col-span-3">
              <label className="block text-xs text-gray-600 mb-1">Public link slug</label>
              <input
                className="border rounded px-3 py-2 w-full"
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
              <label htmlFor={`public-${item.id}`} className="text-sm text-gray-700">Publicly visible</label>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Description (optional)</label>
            <textarea
              className="border rounded px-3 py-2 w-full"
              rows={3}
              value={local.description ?? ''}
              onChange={e=> setLocal({ ...local, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Scheduling mode</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={local.scheduling_mode}
              onChange={e=> setLocal({ ...local, scheduling_mode: e.target.value as 'solo' | 'round_robin' })}
            >
              <option value="solo">Solo (only me)</option>
              <option value="round_robin">Round robin (rotate between hosts)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Round robin automatically assigns the time to the available host with the lightest upcoming load.
            </p>
          </div>
          <div>
            <button onClick={save} className="px-3 py-1 rounded bg-black text-white" disabled={saving}>{saving? 'Saving…':'Save'}</button>
          </div>
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">Team hosts</h4>
              {hostsLoading && <span className="text-xs text-gray-500">Loading…</span>}
            </div>
            {hostError && <div className="text-xs text-red-600 mb-2">{hostError}</div>}
            <ul className="space-y-2">
              {hosts.map((host) => (
                <li key={host.user_id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium text-gray-800">{host.display_name || host.email || host.username || host.user_id.slice(0,8)}</div>
                    <div className="text-xs text-gray-500">
                      {host.email || host.username || host.user_id}
                      {host.user_id === item.user_id && ' • Owner'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    disabled={host.user_id === item.user_id}
                    onClick={() => removeHost(host.user_id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
              {hosts.length === 0 && !hostsLoading && (
                <li className="text-xs text-gray-500">Only you are hosting this event.</li>
              )}
            </ul>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="host@company.com"
                value={hostEmail}
                onChange={e=> setHostEmail(e.target.value)}
                className="border rounded px-3 py-2 flex-1"
              />
              <button
                type="button"
                className="px-3 py-2 rounded border"
                onClick={addHost}
              >
                Add host
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Hosts need a CalendlAI account. We&rsquo;ll invite them via email once added.
            </p>
          </div>
          <div className="text-sm text-gray-700">Preview next 7 days</div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            {preview.map(p => (
              <div key={p.date} className={`rounded border p-2 ${p.slots>0? '':'opacity-50'}`}>
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
