import Head from "next/head";
import type { GetServerSideProps } from "next";
import { supabaseServerClient as supabase } from "../../lib/supabaseClient";
import BookEvent from "../book/[id]";

interface PublicEventType {
  event_type_id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  scheduling_mode: string;
  owner_id: string;
  owner_username: string;
  owner_display_name: string;
  owner_accent_color: string;
  owner_timezone: string;
  team_id: string | null;
  team_name: string | null;
}

type PageProps = {
  username: string;
  event: PublicEventType;
};

export default function HostEventPage({ username, event }: PageProps) {
  const accent = event.owner_accent_color || "#2563eb";
  const pageTitle = `${event.name} · ${event.owner_display_name}`;
  const metaDescription =
    event.description || `Book ${event.name} with ${event.owner_display_name}`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        {baseUrl && (
          <>
            <meta property="og:url" content={`${baseUrl}/${username}/${event.slug}`} />
            <meta property="og:title" content={pageTitle} />
            <meta property="og:description" content={metaDescription} />
          </>
        )}
      </Head>
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <section
          className="border-b border-slate-200 bg-white px-6 py-10 sm:px-10"
          style={{ background: `${accent}15`, borderColor: `${accent}33` }}
        >
          <div className="mx-auto max-w-3xl">
            <p className="text-xs uppercase tracking-wide text-slate-500">CalendlAI event</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{event.name}</h1>
            <div className="mt-2 text-sm text-slate-500">
              Hosted by <span className="font-medium text-slate-700">{event.owner_display_name}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
              <span>{event.duration_minutes} min</span>
              {event.scheduling_mode !== "solo" && (
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
                  {event.scheduling_mode === "round_robin" ? "Round robin" : "Team"}
                </span>
              )}
              {event.team_name && (
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
                  Team: {event.team_name}
                </span>
              )}
            </div>
            {event.description && (
              <p className="mt-4 max-w-2xl text-sm text-slate-600">{event.description}</p>
            )}
          </div>
        </section>
        <section className="px-6 py-12 sm:px-10">
          <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <BookEvent eventTypeId={event.event_type_id} hostUsername={username} />
          </div>
        </section>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<PageProps> = async ({ params }) => {
  const username = params?.username?.toString() ?? "";
  const slug = params?.slug?.toString() ?? "";
  if (!username || !slug) {
    return { notFound: true };
  }

  const { data, error } = await supabase.rpc("public_host_event_type", {
    p_username: username,
    p_slug: slug,
  });

  if (error) {
    console.error("public host event error", error.message);
  }

  const event = Array.isArray(data) ? (data[0] as PublicEventType | undefined) : undefined;
  if (!event) {
    return { notFound: true };
  }

  return {
    props: {
      username,
      event,
    },
  };
};
