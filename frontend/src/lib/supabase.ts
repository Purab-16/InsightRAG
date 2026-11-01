import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Created on first use (not at import), so builds and prerendering do not need the env vars. */
export function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  // Only the public (anon) key lives in the browser. The service role key stays in the backend.
  client ??= createClient(url, anonKey);
  return client;
}

let pending: Promise<string> | null = null;

/**
 * Access token of the current guest. Signs in anonymously on first use, so there is no login screen.
 * Concurrent callers share one sign-in. `captchaToken` is the hook for Turnstile (enabled at deploy time).
 */
export function getAccessToken(captchaToken?: string): Promise<string> {
  pending ??= (async () => {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session.access_token;

    const { data: signedIn, error } = await supabase.auth.signInAnonymously(
      captchaToken ? { options: { captchaToken } } : undefined,
    );
    if (error || !signedIn.session) throw new Error("Could not start a guest session. Reload the page.");
    return signedIn.session.access_token;
  })().finally(() => {
    pending = null;
  });
  return pending;
}
