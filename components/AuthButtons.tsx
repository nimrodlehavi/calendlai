"use client";
import Link from "next/link";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";
import { useEffect, useState } from "react";

export default function AuthButtons() {
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabaseBrowserClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthed(!!data.session);
    });
    const { data: sub } = supabaseBrowserClient.auth.onAuthStateChange((_e, s) => {
      setAuthed(!!s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function loginWithEmail(email: string) {
    setLoading(true);
    const { error } = await supabaseBrowserClient.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) alert(error.message);
    else alert("Check your email for a login link!");
  }

  async function loginWithGoogle() {
    if (loading) return;
    try {
      setLoading(true);
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
      const { data, error } = await supabaseBrowserClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          scopes: "openid email profile https://www.googleapis.com/auth/calendar",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) {
        setLoading(false);
        alert(error.message);
        return;
      }
      if (data?.url) {
        if (typeof window !== "undefined") {
          window.location.assign(data.url);
        }
        return;
      }
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      alert(String(err?.message || err));
    }
  }

  async function logout() {
    await supabaseBrowserClient.auth.signOut();
  }

  if (authed) {
    return (
      <div className="flex gap-2 items-center">
        <Link href="/event-types" className="px-3 py-1 rounded border">Event Types</Link>
        <Link href="/availability" className="px-3 py-1 rounded border">Availability</Link>
        <Link href="/bookings" className="px-3 py-1 rounded border">Bookings</Link>
        <Link href="/settings" className="px-3 py-1 rounded border">Settings</Link>
        <button onClick={logout} className="bg-gray-800 text-white px-3 py-1 rounded">Logout</button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-gray-600">Login with</span>
      <button
        onClick={() => {
          if (loading) return;
          const email = prompt("Enter your email");
          if (email) loginWithEmail(email);
        }}
        disabled={loading}
        className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-60"
      >
        {loading ? "Sending..." : "Email"}
      </button>
      <button
        onClick={loginWithGoogle}
        disabled={loading}
        className="border border-gray-300 text-gray-800 px-3 py-1 rounded disabled:opacity-60"
      >
        {loading ? "Redirecting..." : "Google"}
      </button>
    </div>
  );
}
