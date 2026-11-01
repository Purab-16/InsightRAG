import { api, errorMessage } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";

// When a guest signs in to an existing account, the guest's papers and chats are copied into that account.
// Email sign-in does it straight away. Google leaves the page, so the guest token waits in sessionStorage.
const STASH_KEY = "insightrag.guest-token";
const FLASH_KEY = "insightrag.flash";
const STASH_MAX_AGE_MS = 50 * 60 * 1000; // guest access tokens last an hour

/** Access token of the current guest session, or null when there is none (or the user is already signed in). */
export async function currentGuestToken(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  const session = data.session;
  return session && session.user.is_anonymous ? session.access_token : null;
}

export function stashGuestToken(token: string) {
  try {
    sessionStorage.setItem(STASH_KEY, JSON.stringify({ token, at: Date.now() }));
  } catch {
    // Private mode: the Google sign-in still works, the guest data just is not copied.
  }
}

/** The stashed guest token, removed on read. Null when missing or too old to still be valid. */
export function takeStashedGuestToken(): string | null {
  try {
    const raw = sessionStorage.getItem(STASH_KEY);
    sessionStorage.removeItem(STASH_KEY);
    if (!raw) return null;
    const { token, at } = JSON.parse(raw) as { token: string; at: number };
    return Date.now() - at < STASH_MAX_AGE_MS ? token : null;
  } catch {
    return null;
  }
}

export interface Flash {
  kind: "success" | "error";
  text: string;
}

/** A message to show after the page reloads. */
export function setFlash(flash: Flash) {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify(flash));
  } catch {
    // Nothing to do; the message is only a courtesy.
  }
}

export function takeFlash(): Flash | null {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    sessionStorage.removeItem(FLASH_KEY);
    return raw ? (JSON.parse(raw) as Flash) : null;
  } catch {
    return null;
  }
}

/** Copies the guest's data into the signed-in account and leaves a message for after the reload. Never throws. */
export async function copyGuestData(guestToken: string): Promise<void> {
  try {
    const r = await api.mergeGuest(guestToken);
    const parts = [
      r.papers_copied && `${r.papers_copied} paper${r.papers_copied === 1 ? "" : "s"}`,
      r.chats_moved && `${r.chats_moved} chat${r.chats_moved === 1 ? "" : "s"}`,
    ].filter(Boolean);
    setFlash({
      kind: "success",
      text: parts.length ? `Signed in. Copied ${parts.join(" and ")} from your guest session.` : "Signed in.",
    });
  } catch (e) {
    setFlash({
      kind: "error",
      text: `Signed in, but your guest papers and chats could not be copied: ${errorMessage(e)}`,
    });
  }
}
