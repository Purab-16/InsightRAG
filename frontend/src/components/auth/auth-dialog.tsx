"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { authErrorMessage, redirectUrl } from "@/lib/auth";
import { copyGuestData, currentGuestToken, stashGuestToken } from "@/lib/guest-merge";
import { getAccessToken, getSupabase } from "@/lib/supabase";

export type AuthMode = "claim" | "signin";

const MIN_PASSWORD = 8;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}

/**
 * "claim": turn this guest session into an account. Keeps the library and chats, and never merges into an
 * account that already exists. "signin": open an existing account; this guest session's data stays behind.
 */
export function AuthDialog({ open, onOpenChange, mode, onModeChange }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const claim = mode === "claim";

  function switchMode(next: AuthMode) {
    setError(null);
    setNotice(null);
    onModeChange(next);
  }

  async function google() {
    setBusy(true);
    setError(null);
    const auth = getSupabase().auth;
    const options = { redirectTo: redirectUrl() };
    try {
      // Linking needs a guest session to attach to; start one if the first API call has not yet.
      if (claim) await getAccessToken();
      else {
        // Google leaves the page, so keep the guest token for the copy step when we come back.
        const guestToken = await currentGuestToken();
        if (guestToken) stashGuestToken(guestToken);
      }
      const { error } = claim
        ? await auth.linkIdentity({ provider: "google", options })
        : await auth.signInWithOAuth({ provider: "google", options });
      // On success the browser is sent to Google, so there is nothing more to do here.
      if (error) throw error;
    } catch (err) {
      setError(authErrorMessage(err, claim));
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const address = email.trim();
    if (claim && password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for the password.`);
      return;
    }

    setBusy(true);
    const auth = getSupabase().auth;
    try {
      if (claim) {
        await getAccessToken();
        const { data, error } = await auth.updateUser({ email: address, password }, { emailRedirectTo: redirectUrl() });
        if (error) throw error;
        if (data.user?.new_email) {
          setNotice(
            `We sent a confirmation link to ${address}. Until you open it you stay a guest, and your library is safe.`,
          );
        } else {
          toast.success("Account created. Your library and chats are saved to it.");
          onOpenChange(false);
        }
      } else {
        // Take the guest token before signing in: the guest session is replaced by the account's session.
        const guestToken = await currentGuestToken();
        const { error } = await auth.signInWithPassword({ email: address, password });
        if (error) throw error;
        if (guestToken) await copyGuestData(guestToken);
        // Reload so the library, chats and usage all load for the account we just opened.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose: the user changed, so every client cache must start fresh
        window.location.href = `${window.location.origin}/`;
      }
    } catch (err) {
      setError(authErrorMessage(err, claim));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{claim ? "Claim your account" : "Sign in"}</DialogTitle>
          <DialogDescription>
            {claim
              ? "Save your library and chats to an account so you can open them on any device."
              : "Open an account you already have. The papers and chats of this guest session are copied into it."}
          </DialogDescription>
        </DialogHeader>

        <Button variant="outline" className="h-10 w-full" onClick={() => void google()} disabled={busy}>
          <span aria-hidden className="font-semibold">
            G
          </span>
          {claim ? "Link Google account" : "Continue with Google"}
        </Button>

        <div className="flex items-center gap-3 text-[12px] text-text-muted" aria-hidden>
          <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="text-[13px] font-medium">
              Email
            </label>
            <Input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="auth-password" className="text-[13px] font-medium">
              Password
            </label>
            <Input
              id="auth-password"
              type="password"
              required
              minLength={claim ? MIN_PASSWORD : undefined}
              autoComplete={claim ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10"
            />
            {claim && <p className="text-[12px] text-text-muted">At least {MIN_PASSWORD} characters.</p>}
          </div>

          <Button type="submit" className="h-10 w-full" disabled={busy || !email.trim() || !password}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {claim ? "Create account" : "Sign in"}
          </Button>
        </form>

        {error && (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-[13px] text-success">
            {notice}
          </p>
        )}

        <p className="text-[13px] text-text-muted">
          {claim ? "Already have an account? " : "New here? "}
          <button
            type="button"
            className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => switchMode(claim ? "signin" : "claim")}
          >
            {claim ? "Sign in" : "Claim this guest session"}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
