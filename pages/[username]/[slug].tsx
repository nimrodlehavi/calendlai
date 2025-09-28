import Booking from "../../components/booking";

export default function BookingPage({
  username,
  slug,
  eventType,
}: {
  username: string;
  slug: string;
  eventType: any | null;
}) {
  if (!eventType) {
    return <main className="p-6">Event type not found</main>;
  }

  return <Booking username={username} slug={slug} />;
}

export async function getServerSideProps({ params }: any) {
  // ✅ Guard against missing env vars on Vercel
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    console.error("Supabase env vars are missing");
    return { props: { username: params.username, slug: params.slug, eventType: null } };
  }

  // Lazy import to avoid build-time crashes
  const { supabase } = await import("../../lib/supabase");

  // 1. Fetch event type for this slug + user
  const { data: eventType, error } = await supabase
    .from("event_types")
    .select("id, slug, name, duration_min, active")
    .eq("owner_username", params.username)
    .eq("slug", params.slug)
    .eq("active", true)
    .single();

  if (error) {
    console.error("Event type fetch error:", error.message);
    return { props: { username: params.username, slug: params.slug, eventType: null } };
  }

  return { props: { username: params.username, slug: params.slug, eventType } };
}
