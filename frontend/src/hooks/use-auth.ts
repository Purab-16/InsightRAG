"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

/**
 * The signed-in user. A guest session only exists once the first API call has signed in anonymously,
 * so `user` can be null for a moment on first load. `account` is true for a real (non-guest) account.
 */
export function useAuth() {
  const [state, setState] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: false });

  useEffect(() => {
    // Fires once straight away with the stored session, then on every sign-in, sign-out or account change.
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, ready: true });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const account = !!state.user && !state.user.is_anonymous;
  return { ...state, account, email: state.user?.email ?? null };
}
