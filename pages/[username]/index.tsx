import { supabase } from "../../lib/supabase";
import Link from "next/link";

export default function UserPage({ user, eventTypes }: any) {
  if (!user) return <main className="p-6">User not found</main>;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-bold">{user.display_name}</h1>
      <p className="mt-2 text-gray-600">{user.bio}</p>

      <ul className="mt-6 space-y-3">
        {eventTypes.map((et: any) => (
          <li key={et.id}>
            <Link href={`/${user.username}/${et.slug}`}>
              {et.name} · {et.duration_min} min
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

export async function getServerSideProps({ params }: any) {
  // ✅ Guard against missing env vars on Vercel
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    console.error("Supabase env vars are missing");
    return { props: { user: null, eventTypes: [] } };
  }

  // 1. Fetch user
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, username, display_name, bio")
    .eq("username", params.username)
    .single();

  if (userError || !user) {
    console.error("User fetch error:", userError?.message);
    return { props: { user: null, eventTypes: [] } };
  }

  // 2. Fetch event types
  const { data: eventTypes, error: etError } = await supabase
    .from("event_types")
    .select("id, slug, name, duration_min")
    .eq("owner_username", params.username)
    .eq("active", true);

  if (etError) {
    console.error("Event types fetch error:", etError.message);
    return { props: { user, eventTypes: [] } };
  }

  return { props: { user, eventTypes: eventTypes || [] } };
}
