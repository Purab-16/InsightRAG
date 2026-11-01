import { toast } from "sonner";
import { formatLocalTime } from "@/lib/format";
import { getAccessToken, getSupabase } from "@/lib/supabase";
import type {
  AddPaperResponse,
  ArxivResult,
  CompareResponse,
  ErrorCode,
  GraphResponse,
  Message,
  PaperDetail,
  PaperSummary,
  SendMessageResponse,
  Session,
  Usage,
} from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const COLD_START_MS = 5000;

/** Error from the backend, using the uniform {"error": {code, message, reset_at}} body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | "network",
    message: string,
    readonly resetAt: Date | null = null,
    readonly retryAfter: number | null = null,
  ) {
    super(message);
  }

  /** Daily quota (papers, messages or the global AI budget): has a reset time. */
  get isDailyLimit() {
    return this.status === 429 && this.resetAt !== null;
  }

  /** Too many requests in a minute: has Retry-After seconds. */
  get isBurstLimit() {
    return this.status === 429 && this.resetAt === null;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let body: { error?: { code?: ErrorCode; message?: string; reset_at?: string | null } } = {};
  try {
    body = await res.json();
  } catch {
    // Non-JSON error (proxy, crash): fall through to the generic message.
  }
  const retry = Number(res.headers.get("Retry-After"));
  return new ApiError(
    res.status,
    body.error?.code ?? "upstream_error",
    body.error?.message ?? "Something went wrong. Try again.",
    body.error?.reset_at ? new Date(body.error.reset_at) : null,
    Number.isFinite(retry) && retry > 0 ? retry : null,
  );
}

async function request(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  // Free-tier hosts sleep when idle; tell the user if the first call is slow.
  const coldTimer = setTimeout(
    () => toast.loading("Waking up the server. This can take up to a minute on the free plan.", { id: "cold-start" }),
    COLD_START_MS,
  );

  try {
    const token = await getAccessToken();
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });

    // Token expired or the guest was removed: start a fresh guest session once and retry.
    if (res.status === 401 && !retried) {
      await getSupabase().auth.signOut();
      return request(path, init, true);
    }
    if (!res.ok) throw await parseError(res);
    return res;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, "network", "Can't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(coldTimer);
    toast.dismiss("cold-start");
  }
}

/** Fired after a call that uses up a daily quota, so usage meters refresh. */
export const USAGE_CHANGED = "usage-changed";

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await request(path, init);
  if (init.method === "POST" && /\/(papers\/arxiv|papers\/upload|messages)$/.test(path)) {
    window.dispatchEvent(new Event(USAGE_CHANGED));
  }
  return res.json() as Promise<T>;
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Message to show in a toast or banner for any error. Burst limits include the wait time. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError && e.isBurstLimit) {
    return `Slow down a little. Try again in ${e.retryAfter ?? 60} seconds.`;
  }
  if (e instanceof ApiError && e.isDailyLimit && e.resetAt) {
    return `${e.message} You can try again after ${formatLocalTime(e.resetAt)}.`;
  }
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/** Downloads a backend file. It needs the auth header, so a plain link would not work. */
async function download(path: string, filename: string) {
  const blob = await (await request(path)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Round-trip time of the public /health call in ms, or null when the server is not reachable. */
async function ping(): Promise<number | null> {
  const start = performance.now();
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    return res.ok ? Math.round(performance.now() - start) : null;
  } catch {
    return null;
  }
}

export const api = {
  ping,
  usage: () => json<Usage>("/api/me/usage"),
  mergeGuest: (guestToken: string) =>
    json<{ papers_copied: number; uploads_moved: number; chats_moved: number }>(
      "/api/me/merge-guest",
      post({ guest_token: guestToken }),
    ),

  compare: (paperIds: string[]) => json<CompareResponse>("/api/compare", post({ paper_ids: paperIds })),
  graph: (paperId: string, limit = 20) => json<GraphResponse>(`/api/papers/${paperId}/graph?limit=${limit}`),
  exportPaper: (paperId: string, filename: string) => download(`/api/export/paper/${paperId}.md`, filename),
  exportSession: (sessionId: string, filename: string) => download(`/api/export/session/${sessionId}.md`, filename),

  listPapers: async () => (await json<{ papers: PaperSummary[] }>("/api/papers")).papers,
  getPaper: (id: string) => json<PaperDetail>(`/api/papers/${id}`),
  addArxiv: (arxivId: string) => json<AddPaperResponse>("/api/papers/arxiv", post({ arxiv_id: arxivId })),
  uploadPdf: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return json<AddPaperResponse>("/api/papers/upload", { method: "POST", body: form });
  },
  retryPaper: (id: string) => json<AddPaperResponse>(`/api/papers/${id}/retry`, { method: "POST" }),

  searchArxiv: async (q: string, maxResults = 10) =>
    (await json<{ results: ArxivResult[] }>(`/api/arxiv/search?q=${encodeURIComponent(q)}&max_results=${maxResults}`))
      .results,

  createSession: (paperIds: string[], title?: string) =>
    json<Session>("/api/chat/sessions", post({ paper_ids: paperIds, title: title ?? null })),
  listSessions: async () => (await json<{ sessions: Session[] }>("/api/chat/sessions")).sessions,
  getMessages: (sessionId: string) =>
    json<{ session: Session; messages: Message[] }>(`/api/chat/sessions/${sessionId}/messages`),
  sendMessage: (sessionId: string, content: string) =>
    json<SendMessageResponse>(`/api/chat/sessions/${sessionId}/messages`, post({ content })),
};
