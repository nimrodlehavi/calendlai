"use client";
import Layout from "../components/Layout";
import { useEffect, useState } from "react";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";
import { Toast } from "../components/Toast";

type ProfileForm = {
  username: string;
  display_name: string;
  headline: string;
  bio: string;
  avatar_url: string;
  website_url: string;
  location: string;
  accent_color: string;
  include_all_day_blocks: boolean;
};

const emptyProfile: ProfileForm = {
  username: "",
  display_name: "",
  headline: "",
  bio: "",
  avatar_url: "",
  website_url: "",
  location: "",
  accent_color: "#2563eb",
  include_all_day_blocks: true,
};

export default function Settings() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [originalUsername, setOriginalUsername] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error'|'info' } | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleBusy, setGoogleBusy] = useState<string | null>(null);
  const [serviceRole, setServiceRole] = useState<boolean | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{ expires_at?: string|null; hasRefresh?: boolean }|null>(null);
  const [migration, setMigration] = useState<{ oauth_states: boolean|null; calendars: boolean|null }|null>(null)
  const [timezone, setTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [workDays, setWorkDays] = useState<number[]>([1,2,3,4,5])
  const [workStart, setWorkStart] = useState<string>('09:00')
  const [workEnd, setWorkEnd] = useState<string>('17:00')
  const [suggestingLocation, setSuggestingLocation] = useState(false)

  useEffect(() => {
    supabaseBrowserClient.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabaseBrowserClient.auth.onAuthStateChange((_e, s) => {
      setEmail(s?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const run = async () => {
      const { data: u } = await supabaseBrowserClient.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      const { data } = await supabaseBrowserClient
        .from("users")
        .select(
          "username, display_name, headline, bio, avatar_url, website_url, location, accent_color, timezone, include_all_day_blocks"
        )
        .eq("id", u.user.id)
        .single();
      setProfile({
        username: data?.username ?? "",
        display_name: data?.display_name ?? "",
        headline: data?.headline ?? "",
        bio: data?.bio ?? "",
        avatar_url: data?.avatar_url ?? "",
        website_url: data?.website_url ?? "",
        location: data?.location ?? "",
        accent_color: data?.accent_color ?? "#2563eb",
        include_all_day_blocks: data?.include_all_day_blocks !== false,
      });
      setOriginalUsername(data?.username ?? '');
      if (!data?.location) suggestLocation()
      await refreshCalendarState(u.user.id);
      try {
        const s = await fetch('/api/system/status').then(r=> r.json()); setServiceRole(!!s.hasServiceRole);
        const mc = await fetch('/api/system/migration-check').then(r=> r.json()); setMigration(mc.tables || null);
      } catch { setServiceRole(null); setMigration(null) }
    };
    run();
  }, [email]);

  async function refreshCalendarState(uid: string) {
    const { data: cal } = await supabaseBrowserClient
      .from('calendars')
      .select('id, expires_at, refresh_token')
      .eq('user_id', uid)
      .eq('provider','google')
      .maybeSingle();
    setGoogleConnected(!!cal);
    setTokenInfo(cal ? { expires_at: (cal as any).expires_at || null, hasRefresh: !!(cal as any).refresh_token } : null);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: u } = await supabaseBrowserClient.auth.getUser();
    if (!u.user) {
      setSaving(false);
      return;
    }
    const payload = {
      id: u.user.id,
      username: profile.username.trim(),
      display_name: profile.display_name.trim(),
      headline: profile.headline.trim() || null,
      bio: profile.bio.trim() || null,
      avatar_url: profile.avatar_url.trim() || null,
      website_url: profile.website_url.trim() || null,
      location: profile.location.trim() || null,
      accent_color: profile.accent_color || "#2563eb",
      include_all_day_blocks: profile.include_all_day_blocks,
    };
    const { error } = await supabaseBrowserClient.from("users").upsert(payload);
    setSaving(false);
    if (error) setToast({ msg: error.message, type: 'error' });
    else setToast({ msg: 'Saved profile', type: 'success' });
  }

  async function requireAccessToken() {
    const { data: sessionRes } = await supabaseBrowserClient.auth.getSession();
    const at = sessionRes.session?.access_token;
    if (!at) {
      setToast({ msg: 'Please sign in again', type: 'error' });
      return null;
    }
    return at;
  }

  async function suggestLocation() {
    if (suggestingLocation || profile.location) return;
    setSuggestingLocation(true);
    try {
      const res = await fetch('/api/system/geo');
      if (!res.ok) throw new Error('location lookup failed');
      const data = await res.json();
      if (data?.city) {
        const candidate = [data.city, data.region, data.country].filter(Boolean).join(', ');
        setProfile(prev => ({ ...prev, location: prev.location || candidate }));
      }
    } catch {
      // silent fail
    } finally {
      setSuggestingLocation(false);
    }
  }

  const tokenExpired = tokenInfo?.expires_at
    ? new Date(tokenInfo.expires_at).getTime() < Date.now() - 60_000
    : false;
  const needsReconnect = googleConnected && (!tokenInfo?.hasRefresh || tokenExpired);

  return (
    <Layout>
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        {serviceRole === false && (
          <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            Warning: Server role key not configured. Calendar inserts and host notifications are disabled.
          </div>
        )}
        {serviceRole && migration && (migration.oauth_states === false || migration.calendars === false) && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            Google connection tables missing in Supabase.
            <details className="mt-2">
              <summary className="cursor-pointer">Show SQL to create</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs">
{`-- calendars
create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('google','microsoft','zoom')),
  access_token text,
  refresh_token text,
  scope text,
  expires_at timestamptz,
  primary_calendar_id text,
  created_at timestamptz default now()
);
alter table public.calendars enable row level security;
-- RLS policies
create policy if not exists calendars_select_self on public.calendars for select using (user_id = auth.uid());
create policy if not exists calendars_insert_self on public.calendars for insert with check (user_id = auth.uid());
create policy if not exists calendars_update_self on public.calendars for update using (user_id = auth.uid());
create policy if not exists calendars_delete_self on public.calendars for delete using (user_id = auth.uid());

-- oauth_states (service-role only)
create table if not exists public.oauth_states (
  state text primary key,
  user_id uuid references public.users(id) on delete cascade,
  provider text not null,
  created_at timestamptz default now()
);
alter table public.oauth_states disable row level security;`}
              </pre>
            </details>
          </div>
        )}
        {email ? (
          <>
            <p>Signed in as {email}</p>
            <form onSubmit={saveProfile} className="mt-4 space-y-3 max-w-md">
              <div className="grid gap-2">
                <label className="block text-sm font-medium">Username</label>
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={profile.username}
                  onChange={(e) => setProfile((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="your-handle"
                />
                {!!profile.username && (
                  <UsernameHint username={profile.username} original={originalUsername} />
                )}
              </div>
              <div className="grid gap-2">
                <label className="block text-sm font-medium">Display name</label>
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={profile.display_name}
                  onChange={(e) => setProfile((prev) => ({ ...prev, display_name: e.target.value }))}
                  placeholder="Your Name"
                />
              </div>
            <div className="grid gap-2">
              <div>
                <label className="block text-sm font-medium">Accent color</label>
                <input
                  type="color"
                  className="h-10 w-full rounded border px-2"
                  value={profile.accent_color || "#2563eb"}
                  onChange={(e) => setProfile((prev) => ({ ...prev, accent_color: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="include-all-day"
                type="checkbox"
                checked={profile.include_all_day_blocks}
                onChange={(e) => setProfile((prev) => ({ ...prev, include_all_day_blocks: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="include-all-day" className="text-sm text-gray-700">
                Block all-day Google Calendar events
              </label>
            </div>
              <div>
                <label className="block text-sm font-medium">Headline</label>
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={profile.headline}
                  onChange={(e) => setProfile((prev) => ({ ...prev, headline: e.target.value }))}
                  placeholder="Founder · Product Lead"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Short bio</label>
                <textarea
                  className="border rounded px-3 py-2 w-full min-h-[110px]"
                  value={profile.bio}
                  onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell invitees what to expect."
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Location</label>
                  <input
                    className="border rounded px-3 py-2 w-full"
                    value={profile.location}
                    onChange={(e) => setProfile((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="Berlin, Remote"
                  />
                  {!profile.location && suggestingLocation && (
                    <div className="pt-1 text-xs text-gray-500">Detecting from IP…</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium">Website</label>
                  <input
                    className="border rounded px-3 py-2 w-full"
                    value={profile.website_url}
                    onChange={(e) => setProfile((prev) => ({ ...prev, website_url: e.target.value }))}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">Avatar image URL</label>
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={profile.avatar_url}
                  onChange={(e) => setProfile((prev) => ({ ...prev, avatar_url: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
              <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                Public page:{" "}
                {profile.username
                  ? `${typeof window !== "undefined" ? window.location.origin : ""}/${profile.username}`
                  : "Set a username to generate your share link."}
              </div>

              <button className="bg-black text-white px-3 py-2 rounded" disabled={saving}>{saving? 'Saving…':'Save profile'}</button>
            </form>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => supabaseBrowserClient.auth.signOut()}
                className="rounded bg-gray-700 px-3 py-2 text-sm font-medium text-white"
              >
                Sign out
              </button>

              {googleConnected ? (
                <div className="space-y-3">
                  <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium">Google Calendar connected</span>
                      {tokenInfo && (
                        <span className="text-xs text-green-700">
                          {tokenInfo.expires_at
                            ? `Access expires ${new Date(tokenInfo.expires_at).toLocaleString()}`
                            : 'Access token active'}
                          {tokenInfo.hasRefresh ? ' • refresh enabled' : ' • no refresh token'}
                        </span>
                      )}
                    </div>
                    {needsReconnect && (
                      <div className="text-xs text-yellow-700">We recommend re-authorizing to keep syncing.</div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        const at = await requireAccessToken();
                        if (!at) return;
                        setGoogleBusy('refresh');
                        try {
                          const res = await fetch('/api/integrations/google/sync-token', {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${at}` },
                          });
                          const body = await res.json().catch(() => ({}));
                          if (!res.ok) throw new Error(body.error || 'Unable to refresh access');
                          setToast({ msg: 'Google token refreshed', type: 'success' });
                          if (userId) await refreshCalendarState(userId);
                        } catch (err: any) {
                          setToast({ msg: String(err.message || err), type: 'error' });
                        } finally {
                          setGoogleBusy(null);
                        }
                      }}
                      className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
                      disabled={googleBusy !== null}
                    >
                      {googleBusy === 'refresh' ? 'Refreshing…' : 'Refresh access token'}
                    </button>

                    {needsReconnect && (
                      <button
                        onClick={async () => {
                          const at = await requireAccessToken();
                          if (!at) return;
                          setGoogleBusy('reconnect');
                          try {
                            const disconnectRes = await fetch('/api/integrations/google/disconnect', {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${at}` },
                            });
                            if (!disconnectRes.ok) {
                              const body = await disconnectRes.json().catch(() => ({}));
                              throw new Error(body.error || 'Failed to clear existing connection');
                            }
                            const startRes = await fetch('/api/integrations/google/start', {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${at}` },
                            });
                            const body = await startRes.json().catch(() => ({}));
                            if (!startRes.ok || !body.url) throw new Error(body.error || 'Unable to open Google authorization');
                            location.href = body.url;
                          } catch (err: any) {
                            setGoogleBusy(null);
                            setToast({ msg: String(err.message || err), type: 'error' });
                          }
                        }}
                        className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700"
                        disabled={googleBusy !== null}
                      >
                        {googleBusy === 'reconnect' ? 'Opening Google…' : 'Re-authorize Google'}
                      </button>
                    )}

                    <button
                      onClick={async () => {
                        const at = await requireAccessToken();
                        if (!at) return;
                        setGoogleBusy('disconnect');
                        try {
                          const res = await fetch('/api/integrations/google/disconnect', {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${at}` },
                          });
                          const body = await res.json().catch(() => ({}));
                          if (!res.ok) throw new Error(body.error || 'Failed to disconnect');
                          setToast({ msg: 'Disconnected Google Calendar', type: 'success' });
                          if (userId) await refreshCalendarState(userId);
                        } catch (err: any) {
                          setToast({ msg: String(err.message || err), type: 'error' });
                        } finally {
                          setGoogleBusy(null);
                        }
                      }}
                      className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
                      disabled={googleBusy !== null}
                    >
                      {googleBusy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    const at = await requireAccessToken();
                    if (!at) return;
                    setGoogleBusy('connect');
                    try {
                      const res = await fetch('/api/integrations/google/start', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${at}` },
                      });
                      const body = await res.json().catch(() => ({}));
                      if (!res.ok || !body.url) throw new Error(body.error || 'Unable to start Google OAuth');
                      location.href = body.url;
                    } catch (err: any) {
                      setGoogleBusy(null);
                      setToast({ msg: String(err.message || err), type: 'error' });
                    }
                  }}
                  className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white"
                  disabled={googleBusy !== null}
                >
                  {googleBusy === 'connect' ? 'Opening Google…' : 'Connect Google Calendar'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-700">Please sign in to manage settings.</div>
        )}
        {toast && <Toast message={toast.msg} type={toast.type} />}
      </div>
    </Layout>
  )
}

function UsernameHint({ username, original }: { username: string; original: string }){
  // If the username didn't change, don't show any hint
  if (username === original) return null;
  const [available, setAvailable] = useState<null|boolean>(null)
  useEffect(() => {
    let active = true
    const t = setTimeout(async () => {
      const res = await fetch(`/api/account/username-available?username=${encodeURIComponent(username)}`)
      const data = await res.json()
      if (!active) return
      setAvailable(!!data.available)
    }, 300)
    return ()=> { active = false; clearTimeout(t) }
  }, [username, original])
  if (available === null) return <div className="text-xs text-gray-500 mt-1">Checking availability…</div>
  return available
    ? <div className="text-xs text-green-600 mt-1">Available</div>
    : <div className="text-xs text-red-600 mt-1">Not available</div>
}
