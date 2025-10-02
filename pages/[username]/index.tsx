import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { supabaseServerClient as supabase } from "../../lib/supabaseClient";

type HostProfile = {
  id: string;
  username: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  pronouns: string | null;
  location: string | null;
  website_url: string | null;
  accent_color: string | null;
};

type EventTypeSummary = {
  id: string;
  slug: string;
  name: string;
  duration_minutes: number;
  description: string | null;
  scheduling_mode: string;
  team_name: string | null;
};

type PageProps = {
  profile: HostProfile;
  eventTypes: EventTypeSummary[];
};

export default function HostPage({ profile, eventTypes }: PageProps) {
  const accent = profile.accent_color || "#2563eb";
  const pageTitle = profile.display_name
    ? `${profile.display_name} · CalendlAI`
    : `${profile.username} · CalendlAI`;
  const metaDescription =
    profile.headline ||
    profile.bio ||
    `Book time with ${profile.display_name ?? profile.username} via CalendlAI`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        {baseUrl && (
          <>
            <meta property="og:url" content={`${baseUrl}/${profile.username}`} />
            <meta property="og:title" content={pageTitle} />
            <meta property="og:description" content={metaDescription} />
            {profile.avatar_url && <meta property="og:image" content={profile.avatar_url} />}
          </>
        )}
      </Head>

      <main className="min-h-screen bg-slate-50 text-slate-900">
        <section
          className="border-b border-slate-200 bg-white px-6 py-10 sm:px-10"
          style={{ background: `${accent}15`, borderColor: `${accent}33` }}
        >
          <div className="mx-auto flex max-w-4xl flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-white bg-white shadow">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name ?? profile.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-2xl font-semibold uppercase text-white"
                  style={{ backgroundColor: accent }}
                >
                  {(profile.display_name ?? profile.username).slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wide text-slate-500">CalendlAI host</p>
              <h1 className="text-3xl font-bold tracking-tight">
                {profile.display_name ?? profile.username}
                {profile.pronouns && (
                  <span className="ml-2 text-base font-medium text-slate-500">{profile.pronouns}</span>
                )}
              </h1>
              {profile.headline && <p className="text-lg text-slate-600">{profile.headline}</p>}
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                {profile.location && <span>📍 {profile.location}</span>}
                {profile.website_url && (
                  <a
                    href={profile.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-slate-300 underline-offset-4 hover:decoration-transparent"
                  >
                    Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-10 sm:px-10">
          <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[2fr,_1fr]">
            <div className="space-y-6">
              {profile.bio && (
                <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-700">About</h2>
                  <p className="mt-2 whitespace-pre-line text-slate-600">{profile.bio}</p>
                </article>
              )}

              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-700">Available event types</h2>
                {eventTypes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                    No public event types yet. Check back soon.
                  </div>
                ) : (
                  eventTypes.map((et) => (
                    <div key={et.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-800">{et.name}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                            <span>{et.duration_minutes} min</span>
                            {et.scheduling_mode !== "solo" && (
                              <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
                                {et.scheduling_mode === "round_robin" ? "Round robin" : "Team"}
                              </span>
                            )}
                            {et.team_name && (
                              <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
                                Team: {et.team_name}
                              </span>
                            )}
                          </div>
                          {et.description && (
                            <p className="mt-2 text-sm text-slate-500">{et.description}</p>
                          )}
                        </div>
                        <Link
                          href={`/${profile.username}/${et.slug}`}
                          className="inline-flex items-center justify-center rounded-full border border-transparent bg-slate-900 px-5 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
                          style={{ backgroundColor: accent, boxShadow: `0 8px 18px -12px ${accent}` }}
                        >
                          Pick a time
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Share</h3>
                <p className="mt-2 text-sm text-slate-600">
                  {process.env.NEXT_PUBLIC_APP_URL
                    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/${profile.username}`
                    : `/${profile.username}`}
                </p>
                <p className="mt-4 text-xs text-slate-500">
                  Copy this link to share your booking page with invitees.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<PageProps> = async ({ params }) => {
  const username = params?.username?.toString() ?? "";
  if (!username) {
    return { notFound: true };
  }

  const { data: profileData, error: profileError } = await supabase.rpc("public_host_profile", {
    p_username: username,
  });

  if (profileError) {
    console.error("host profile error", profileError.message);
  }

  const profile = Array.isArray(profileData) ? profileData[0] : null;

  if (!profile) {
    return { notFound: true };
  }

  const { data: eventTypesData, error: eventTypesError } = await supabase.rpc("public_host_event_types", {
    p_username: username,
  });

  if (eventTypesError) {
    console.error("event types error", eventTypesError.message);
  }

  return {
    props: {
      profile,
      eventTypes:
        (eventTypesData ?? []).map((et: any) => ({
          id: et.event_type_id,
          slug: et.slug,
          name: et.name,
          duration_minutes: et.duration_minutes,
          description: et.description ?? null,
          scheduling_mode: et.scheduling_mode ?? "solo",
          team_name: et.team_name ?? null,
        })) ?? [],
    },
  };
};
