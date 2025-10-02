import type { AppProps } from "next/app";
import Head from "next/head";
import "../styles/globals.css";
import AuthButtons from "../components/AuthButtons";
import UserGreeting from "../components/UserGreeting";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";
import type { Session } from "@supabase/supabase-js";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

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
  // Ensure a profile row exists for signed-in users
  useEffect(() => {
    let unsub: (() => void) | null = null;
    const init = async () => {
      const { data } = await supabaseBrowserClient.auth.getSession();
      const sess = data.session;
      if (sess?.access_token) {
        fetch("/api/auth/ensure-user", {
          method: "POST",
          headers: { Authorization: `Bearer ${sess.access_token}` },
        }).catch(() => {});
        await maybeStoreGoogleCredentials(sess);
        if (router.pathname === "/" || router.pathname === "/login") {
          router.replace("/event-types");
        }
      }
      const sub = supabaseBrowserClient.auth.onAuthStateChange(async (event, s) => {
        if (s?.access_token) {
          fetch("/api/auth/ensure-user", {
            method: "POST",
            headers: { Authorization: `Bearer ${s.access_token}` },
          }).catch(() => {});
          await maybeStoreGoogleCredentials(s);
          if (router.pathname === "/" || router.pathname === "/login") {
            router.replace("/event-types");
          }
        }
        if (event === "SIGNED_OUT") {
          if (router.pathname !== "/login") {
            router.replace("/login");
          }
        }
      });
      unsub = () => sub.data.subscription.unsubscribe();
    };
    init();
    return () => {
      if (unsub) unsub();
    };
  }, [router]);
  return (
    <div>
      <Head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </Head>
      <header className="flex justify-between items-center p-4 border-b">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">CalendlAI</h1>
          <UserGreeting />
        </div>
        <AuthButtons />
      </header>
      <main className="p-6">
        <Component {...pageProps} />
      </main>
    </div>
  );
}
