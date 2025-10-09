import type { AppProps } from "next/app";
import Head from "next/head";
import "../styles/globals.css";
import AuthButtons from "../components/AuthButtons";
import UserGreeting from "../components/UserGreeting";
import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useSupabaseSession } from "../hooks/useSupabaseSession";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { session, status } = useSupabaseSession();
  const processedTokensRef = useRef(new Set<string>());

  const maybeStoreGoogleCredentials = async (session: Session | null) => {
    if (!session) return;
    const provider = (session.user?.app_metadata as any)?.provider;
    if (provider !== "google") return;

    const providerAccessToken = (session as any).provider_token as string | undefined;
    const providerRefreshToken = (session as any).provider_refresh_token as string | undefined;
    const hasTokens = providerAccessToken || providerRefreshToken;
    if (!hasTokens) return;

    const approximateExpiry = new Date(Date.now() + 55 * 60 * 1000).toISOString();

    try {
      const { error } = await supabaseBrowserClient
        .from("calendars")
        .upsert(
          {
            user_id: session.user.id,
            provider: "google",
            access_token: providerAccessToken ?? null,
            refresh_token: providerRefreshToken ?? null,
            scope: "https://www.googleapis.com/auth/calendar",
            expires_at: approximateExpiry,
          },
          { onConflict: "user_id,provider" },
        );
      if (error) throw error;
    } catch (error) {
      console.warn("Failed to persist Google credentials", error);
    }
  };
  // Ensure a profile row exists for signed-in users and persist Google tokens.
  useEffect(() => {
    if (status !== "authenticated" || !session?.access_token) return;

    const accessToken = session.access_token;
    if (processedTokensRef.current.has(accessToken)) return;
    processedTokensRef.current.add(accessToken);

    const run = async () => {
      try {
        await fetch("/api/auth/ensure-user", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (err) {
        console.warn("Failed to ensure user profile", err);
      }

      try {
        await maybeStoreGoogleCredentials(session);
      } catch (err) {
        console.warn("Failed to persist Google credentials", err);
      }

      if (router.pathname === "/" || router.pathname === "/login") {
        router.replace("/event-types");
      }
    };

    run();
  }, [session, status, router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      processedTokensRef.current.clear();
      const protectedPrefixes = ["/event-types", "/bookings", "/availability", "/settings"];
      const shouldRedirect =
        router.pathname !== "/login" &&
        protectedPrefixes.some((prefix) => router.pathname.startsWith(prefix));
      if (shouldRedirect) {
        router.replace("/login");
      }
    }
  }, [status, router]);
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 relative">
      <Head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <title>CalendlAI</title>
      </Head>
      <div className="absolute inset-0 -z-10 bg-gradient-hero opacity-80" />
      <div className="absolute inset-0 -z-20 bg-gradient-ai" />
      <div className="absolute inset-0 -z-30 bg-slate-800" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-16 pt-8">
        <header className="glass-panel flex items-center justify-between px-6 py-4 shadow-floating">
          <Link href="/" className="flex items-center gap-3 text-slate-50">
            <span className="relative grid h-10 w-10 place-items-center rounded-full bg-white/10">
              <span className="absolute h-8 w-8 rounded-full bg-accent-teal/40 blur-lg" />
              <span className="relative text-lg font-semibold">CɅ</span>
            </span>
            <div className="leading-tight">
              <p className="text-lg font-semibold">CalendlAI</p>
              <p className="text-xs text-slate-300">AI scheduling co-pilot</p>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <UserGreeting />
            <AuthButtons />
          </div>
        </header>
        <main className="mt-10 flex-1">
          <Component {...pageProps} />
        </main>
        <footer className="mt-10 flex items-center justify-between text-xs text-slate-400">
          <span>© {new Date().getFullYear()} CalendlAI. Crafted with intelligence.</span>
          <div className="flex items-center gap-3">
            <a href="https://calendlai.vercel.app" target="_blank" rel="noreferrer" className="hover:text-accent-teal">
              Production
            </a>
            <a href="/tos" className="hover:text-accent-teal">Terms</a>
            <a href="/privacy" className="hover:text-accent-teal">Privacy</a>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent-teal" />
              Status: Operational
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
