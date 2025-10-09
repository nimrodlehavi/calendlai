"use client";
import Link from "next/link";
import { useState } from "react";
import { useSupabaseSession } from "../hooks/useSupabaseSession";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";
import { buildRedirectUrl } from "../lib/appOrigin";

export default function AuthButtons() {
  const { status } = useSupabaseSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authed = status === "authenticated";

  async function loginWithEmail(email: string) {
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabaseBrowserClient.auth.signInWithOtp({ email });
      if (signInError) throw signInError;
      alert("Check your email for a login link!");
    } catch (err: any) {
      console.error("Magic link sign-in error", err);
      setError(err?.message || "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  }

  async function loginWithGoogle() {
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      const redirectTo = buildRedirectUrl("/");
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
      if (error) throw error;
      if (data?.url) {
        if (typeof window !== "undefined") {
          window.location.assign(data.url);
        }
        return;
      }
    } catch (err: any) {
      console.error("Google sign-in error", err);
      setError(err?.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      setError(null);
      await supabaseBrowserClient.auth.signOut();
    } catch (err: any) {
      console.error("Logout error", err);
      setError(err?.message || "Failed to log out");
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 text-xs text-slate-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent-teal" />
        Checking session…
      </div>
    );
  }

  if (authed) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <nav className="flex flex-wrap items-center gap-1">
          {[
            { href: "/event-types", label: "Event Types" },
            { href: "/availability", label: "Availability" },
            { href: "/bookings", label: "Bookings" },
            { href: "/settings", label: "Settings" },
          ].map((link) => (
            <Link key={link.href} href={link.href} className="btn-secondary px-4 py-2 text-xs">
              {link.label}
            </Link>
          ))}
        </nav>
        <button onClick={logout} className="btn-primary px-5 py-2 text-xs font-semibold">
          Logout
        </button>
        {error && <span className="text-xs text-rose-300">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <span className="text-[11px] font-medium text-slate-300">
        Login with
      </span>
      <button
        onClick={() => {
          if (loading) return;
          const email = prompt("Enter your email");
          if (email) loginWithEmail(email);
        }}
        disabled={loading}
        className="btn-secondary px-5"
      >
        {loading ? "Sending..." : "Email"}
      </button>
      <button onClick={loginWithGoogle} disabled={loading} className="btn-primary px-5">
        {loading ? "Redirecting..." : "Google"}
      </button>
      {error && <span className="w-full text-xs text-rose-300">{error}</span>}
    </div>
  );
}
