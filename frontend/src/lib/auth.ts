/** Where Supabase sends the user back after Google sign-in or an email confirmation. */
export function redirectUrl(): string {
  return window.location.origin;
}

interface AuthLike {
  message?: string;
  code?: string;
}

/**
 * Plain-language text for a Supabase auth error. `linking` is true when the user is turning their guest
 * session into an account (so nothing is ever merged into an account that already exists).
 */
export function authErrorMessage(e: unknown, linking = false): string {
  const err = (e ?? {}) as AuthLike;
  const text = `${err.code ?? ""} ${err.message ?? ""}`.toLowerCase();

  if (/identity_already_exists|already linked|already.*another user/.test(text)) {
    return "That Google account already belongs to an InsightRAG account, so it can't be linked to this guest session. Choose Sign in to open that account. Your guest papers and chats will be copied into it.";
  }
  if (/email_exists|already registered|already been registered|user_already_exists/.test(text)) {
    return linking
      ? "That email already has an account, so it can't be linked to this guest session. Choose Sign in to open it. Your guest papers and chats will be copied into it."
      : "That email is already registered. Try signing in.";
  }
  if (/manual_linking_disabled|manual linking/.test(text)) {
    return "Linking a Google account is not switched on yet (Supabase: Authentication, Sign In / Providers, Allow manual linking).";
  }
  if (/provider is not enabled|unsupported provider|validation_failed.*provider/.test(text)) {
    return "This sign-in method is not enabled yet in Supabase.";
  }
  if (/missing sub claim|session_not_found|auth session missing/.test(text)) {
    return "Your guest session is not ready yet. Reload the page and try again.";
  }
  if (/invalid_credentials|invalid login/.test(text)) return "Wrong email or password.";
  if (/email_not_confirmed|not confirmed/.test(text)) return "Confirm your email first. Check your inbox for the link.";
  if (/weak_password|password should be|at least/.test(text)) {
    return err.message ?? "Choose a stronger password.";
  }
  if (/over_.*_rate_limit|rate limit|too many/.test(text)) return "Too many tries. Wait a minute and try again.";
  return err.message || "Something went wrong. Try again.";
}

/**
 * Supabase sends OAuth and email-link failures back in the URL (query or hash). Returns the message to
 * show, and removes the error from the address bar so a reload does not repeat it.
 */
export function takeAuthRedirectError(): string | null {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.hash.replace(/^#/, ""));
  for (const [k, v] of url.searchParams) if (!params.has(k)) params.set(k, v);

  const description = params.get("error_description");
  const code = params.get("error_code") ?? params.get("error");
  if (!description && !code) return null;

  for (const key of ["error", "error_code", "error_description", "sb"]) {
    url.searchParams.delete(key);
  }
  url.hash = "";
  window.history.replaceState(null, "", url.pathname + url.search);

  return authErrorMessage({ code: code ?? undefined, message: description?.replace(/\+/g, " ") }, true);
}
