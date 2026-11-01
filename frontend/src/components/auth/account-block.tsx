"use client";

import { useEffect, useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AuthDialog, type AuthMode } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { takeAuthRedirectError } from "@/lib/auth";
import { copyGuestData, takeFlash, takeStashedGuestToken } from "@/lib/guest-merge";
import { getSupabase } from "@/lib/supabase";

/** Sidebar and mobile-menu block: guest status with "Claim account" and "Sign in", or the account with "Log out". */
export function AccountBlock() {
  const { account, email, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("claim");
  const [leaving, setLeaving] = useState(false);

  // A failed Google link or email link comes back as an error in the address bar, and a message
  // saved before a reload (for example "Copied 2 papers") is shown once the page is back.
  useEffect(() => {
    const message = takeAuthRedirectError();
    if (message) toast.error(message, { duration: 12000 });
    const flash = takeFlash();
    if (flash) (flash.kind === "success" ? toast.success : toast.error)(flash.text, { duration: 10000 });
  }, []);

  // Back from Google sign-in with a guest token waiting: copy the guest's data into the account, then reload.
  useEffect(() => {
    if (!account) return;
    const guestToken = takeStashedGuestToken();
    if (!guestToken) return;
    void copyGuestData(guestToken).then(() => {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose so the library and chats load for the account
      window.location.href = `${window.location.origin}/`;
    });
  }, [account]);

  function show(next: AuthMode) {
    setMode(next);
    setOpen(true);
  }

  async function logOut() {
    setLeaving(true);
    await getSupabase().auth.signOut();
    // The next page load starts a fresh guest session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose: the user changed, so every client cache must start fresh
    window.location.href = `${window.location.origin}/`;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 text-[14px]">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <UserRound className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate font-medium text-text">{account ? (email ?? "Account") : "Guest"}</p>
          <p className="label-mono normal-case">{account ? "Signed in" : "Anonymous session"}</p>
        </div>
      </div>

      {ready &&
        (account ? (
          <Button variant="outline" size="sm" className="w-full" onClick={() => void logOut()} disabled={leaving}>
            <LogOut aria-hidden /> Log out
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => show("claim")}>
              Claim account
            </Button>
            <Button variant="outline" size="sm" onClick={() => show("signin")}>
              Sign in
            </Button>
          </div>
        ))}

      <AuthDialog open={open} onOpenChange={setOpen} mode={mode} onModeChange={setMode} />
    </div>
  );
}
