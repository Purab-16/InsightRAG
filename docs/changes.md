# InsightRAG - Changes

Log of changes made after the docs were finalized (design, contract, scope or code changes). Newest first.

Rule: if a contract in `BACKEND_SCHEMA.md` changes, update that doc first, then code, then add an entry here.

## Entry format

```
### YYYY-MM-DD - short title
- What changed:
- Why:
- Files / docs affected:
```

---

### 2026-11-01 - Deployed: Render (API) and Vercel (frontend), no code changed
- Backend runs on Render from `render.yaml` at `https://insightrag-api.onrender.com`; frontend on Vercel at `https://insight-rag-puce.vercel.app`. Secrets were set in the dashboards only. `ALLOWED_ORIGINS` on Render is the exact Vercel URL.
- Checked after deploy: `/health` is ok; the response headers on Vercel contain CSP (its `connect-src` has the Render and Supabase origins, so the env vars were present at build time), HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` and `Permissions-Policy`; API CORS answers with the exact Vercel origin and the preflight returns 200. A clean headless Chromium load of the live site got guest sign-up 200, `/health`, `/api/papers` and `/api/me/usage` all 200 and the pill showed "API 1531ms". The user ran the smoke test and the app works.
- Known quirk, left as is (the user's decision): on the user's own browsers (Brave, another Chromium-based one) the "API offline" pill stayed red while the rest of the app worked. The pill is the only call that hits `/health` without a token; the console showed "CORS request did not succeed, status null", a network-level block on that one request, not a server or CORS-header problem. On a cold start the pill can also be red for up to a minute. It is display only.
- Limits are the same for guests and accounts (`DAILY_PAPER_LIMIT` 5, `DAILY_MESSAGE_LIMIT` 30). The sidebar label "Anonymous tier" is a fixed label and does not change after sign-in. Option noted for later: relabel it ("Guest" or "Account"), or give accounts higher limits (needs a change in `quota.py`, `config.py` and the UI).
- Decision (from the user): Turnstile is skipped for now. Supabase CAPTCHA must stay off, because the app sends no captcha token and guest sign-in would fail. The abuse limits stay as they are (per-user daily, global AI budget, per-IP burst). To add it later: build the widget, pass `captchaToken` to anonymous sign-in, sign-up and password sign-in, then enable CAPTCHA in Supabase. Google sign-in is not covered by Supabase CAPTCHA.
- Still open: securityheaders.com grade (the user runs it), Google and email provider setup in Supabase and a real-account test, PDF upload through the UI on Linux (sandbox caps), README screenshots, demo video.
- Files / docs affected: `docs/progress.md`, `README.md`.

### 2026-11-01 - Manual checklist run (no code changed)
- Ran the automatable items of the manual test checklist: 32 API checks across uploads, injection, isolation, limits and rate limiting, a model-level injection test, and a browser rendering check. All passed. Results and the list of what is still open are in `docs/progress.md`.
- Lesson: my first injection test passed for the wrong reason. The test PDF was one chunk and contained "Ignore previous instructions", so the retrieval filter dropped it and every question got the "couldn't find anything" answer. Rewrote it with a line the filter does not match; the model ignored it.
- Left in the database (not deleted): throwaway guests and four test uploads, see `progress.md`.

### 2026-11-01 - Sign in copies the guest's data into the account (replaces "no merge")
- Decision change (from the user): signing in to an existing Google or email account now brings the current guest's library and chats along. The earlier rule "never merge into an account that already exists" now applies only to linking: claiming with an identity that is already registered is still refused, and the message sends the user to Sign in.
- Backend: new `POST /api/me/merge-guest` (`app/routers/me.py`, `app/merge.py`, documented in `BACKEND_SCHEMA.md`). It needs the account's token in the header and the guest's token in the body, the account must be non-anonymous and the guest anonymous, so nobody can pull another person's data or merge two real accounts. It only inserts and updates, never deletes: library entries are copied (original dates kept), uploaded PDFs change owner and the stored file moves to the new owner's folder (needed because `papers.uploaded_by` cascades on delete and the file path is `<owner>/<paper>.pdf`), chat sessions change owner with their messages. If the account already has the same uploaded PDF, that copy is used and the moved chats are re-pointed to it. A broken file is skipped and logged instead of stopping the merge. Safe to run again. `app/auth.py` was split into `verify_token`, `get_user_id` and `get_user` (same behaviour for existing routes).
- Frontend: email sign-in reads the guest token first, signs in, calls the merge, then reloads. Google leaves the page, so the guest token is kept in `sessionStorage` (max 50 minutes) and the merge runs when the signed-in account comes back (`lib/guest-merge.ts`, `components/auth/account-block.tsx`). The result ("Copied 2 papers and 1 chat") shows as a toast after the reload; if the copy fails the user sees "Signed in, but ... could not be copied".
- Side effects to know about: copied items keep today's date, so they count toward the account's daily paper and message quotas; moved chats get a new `updated_at` (the DB trigger), so they sort as newest; the guest's own rows stay behind untouched.
- Tests: `backend/tests/test_merge.py`, 10 unit tests (fake database for the copy logic, idempotency, duplicate upload, missing file; the endpoint's guard rules) all pass. Also ran the real merge once against the Supabase database with two throwaway guest users: library copied, chat moved, second run changed nothing. Browser check: sign-in dialog text, guest token saved before the Google redirect, one-time toast after reload, no page errors.
- Left in the database by that check (I do not delete): two throwaway anonymous users, and one chat session titled "merge test" now owned by one of them.
- NOT tested: the whole flow with a real account (email sign-in then merge, Google round trip then merge, uploaded-PDF move in real storage). The backend must be restarted to pick up the new route (the running one answered 404).
- Files / docs affected: `backend/app/{auth,merge,models}.py`, `backend/app/routers/me.py`, `backend/tests/test_merge.py`, `docs/BACKEND_SCHEMA.md`, `frontend/src/{lib/guest-merge.ts,lib/auth.ts,lib/api.ts,components/auth/*}`, `README.md`.

### 2026-11-01 - Accounts: Google and email/password (moved from stretch/v2 to v1)
- What changed: Sidebar (and mobile menu) account block. Guest: "Claim account" and "Sign in". Signed in: the email and "Log out". Dialog (`components/auth/auth-dialog.tsx`) with two modes. Claim: `linkIdentity` for Google, or `updateUser({email, password})` for email, so the guest's library and chats stay with the same user id. Sign in: `signInWithOAuth` for Google or `signInWithPassword`, followed by a full reload. `hooks/use-auth.ts` follows `onAuthStateChange`. `lib/auth.ts` turns Supabase errors into plain messages and reads errors that come back in the URL after Google or an email link.
- Decisions (from the user): both Google and email/password; if the Google account or email already belongs to an account, linking is refused and nothing is merged; Log out is shown for signed-in accounts (a guest has nothing to log out of). Password minimum is 8 characters (client side).
- Backend: no change. It only reads the user id from the JWT, so a guest and an account behave the same, and quotas stay per user.
- Math: not built. Decision was to keep PDF parsing and state the limitation in the README (done, made more specific).
- Checked in a real browser against the live Supabase project: guest sees Claim account and Sign in; wrong password shows "Wrong email or password."; Sign in with Google redirects to Supabase (so the Google provider is on); an `identity_already_exists` error in the URL shows the "nothing was merged" message and the address bar is cleaned; the mobile menu shows the block; no page errors. Found and fixed: claiming before the guest session existed gave "missing sub claim"; the dialog now starts the guest session first.
- NOT checked, needs the Supabase dashboard: the live check of "Claim with Google" returns "Manual linking is disabled", so **Allow manual linking must be switched on** before Google linking can work. I did not create a real account, so the email/password claim (including the confirmation email), the Google round trip back to the app, and Log out after a real sign-in are untested. One thing to watch: setting email and password in one `updateUser` call for an anonymous user is the part most likely to need adjusting.
- Files / docs affected: `frontend/src/{lib/auth.ts,hooks/use-auth.ts,components/auth/*,components/app-sidebar.tsx,components/app-header.tsx}`, `README.md`.

### 2026-11-01 - PDF export (moved from v2 to v1)
- What changed: "Export PDF" button on the paper page and the chat page. It opens the browser print dialog ("Save as PDF") with the title as the default file name (`lib/print.ts`, `components/print-button.tsx`). Print styles in `globals.css` force the light tokens and a white page, hide the sidebar, top bar, footer, tabs, buttons and chat input (`print:hidden`), and let the chat log grow to full height instead of scrolling.
- Why browser print and not a server-side PDF: no new dependency, no OS libraries on Render, and it works for KaTeX math and the user's own fonts. The trade-off is that the user clicks "Save as PDF" in the dialog.
- Checked: generated real PDFs with headless Chromium from the running app (paper insights, paper chat tab, a chat with an answer): content only, white page and margins, the answer text and citations are present. Not covered: the citation graph tab (a canvas, may print cropped) and the compare table (wider than a portrait page), which have no PDF button.
- Files / docs affected: `frontend/src/{lib/print.ts,components/print-button.tsx,components/export-button.tsx,components/paper/paper-view.tsx,components/chat/{chat-session-view,chat-panel}.tsx,components/{app-header,app-sidebar}.tsx,app/{globals.css,layout.tsx}}`, `README.md`.

### 2026-11-01 - Tasks 2.13 and 2.13a: security headers, mobile and accessibility pass
- Security headers (`frontend/next.config.ts`, from `TRD.md` 8.5): Content-Security-Policy (`default-src 'self'`, scripts from self plus Cloudflare Turnstile, `connect-src` built from `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SUPABASE_URL`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri` and `form-action` self), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. `'unsafe-eval'`, `ws:` and `http://localhost:*` are added in development only. The two env vars are read when the server starts or builds, so set them on Vercel before the first deploy or the API calls will be blocked.
- Already done earlier and re-checked: backend `nosniff`, `/docs` and OpenAPI off in production, strict CORS, no `rehype-raw` or `dangerouslySetInnerHTML` anywhere in `src`, UsageMeter and LimitBanner, privacy note in the footer.
- Mobile and accessibility audit (Playwright plus axe-core against the running dev app, fresh guest): found and fixed (1) compare page overflowed horizontally at 375 px because the four action buttons did not wrap, (2) `aria-label` on a plain div in the top bar (now `role="group"`), (3) top-bar icon buttons, the brand link and the hint dismiss button were 26 to 38 px tall, now 44 px on mobile. After the fixes: no overflow and 0 axe violations on every page at 375 and 1280 px.
- Found while auditing: the redesign made three components call `/me/usage` separately (6 calls per page load in dev), which also eats the per-IP burst limit. `use-usage.ts` now shares one store with a 5 second freshness window, so a page load makes one call. Checked that the top bar, sidebar and library all still update after adding a paper.
- Not done: other action buttons (Switch papers, Export, tabs, filters) are 25 to 32 px tall on mobile. That passes WCAG 2.2 AA (24 px minimum) but not the 44 px guideline.
- CSP production check: the isolated-copy build I tried was blocked, so the user ran `npm run build` and `npm start` locally with the backend up and clicked through add paper, paper page, chat, compare and graph. Result: no CSP errors. The deployed URLs can still differ (different `connect-src` origins), so glance at the console once after the first deploy.
- Files / docs affected: `frontend/next.config.ts`, `src/hooks/use-usage.ts`, `src/components/{app-header,app-sidebar,theme-toggle,command-palette}.tsx`, `components/compare/compare-view.tsx`, `components/library/onboarding-hint.tsx`, `docs/progress.md`.

### 2026-11-01 - Eval results and README draft
- Full eval (20 questions, 5 papers, `--slack 0`): hit@5 95% (19 of 20), faithfulness 100% yes (20 of 20). With 1 page of slack, hit@5 is 100%. The one miss is `lora-03` (answer on page 5, chunk recorded on page 4). Spot-checked three answers by hand (lora-03, gt-04, bo-03): correct and cited.
- Both results are above the PRD targets (75% and 85%), so Task 2.12 has no failure that needs fixing. The README says plainly that this is an easy, short-paper set and that the judge is Gemini checking Gemini.
- Added `README.md` at the repo root. It contains no screenshots, live link or demo video because none exist yet.
- Files / docs affected: `README.md`, `docs/progress.md`.

### 2026-11-01 - Task 2.11 eval runner
- What changed: Added `backend/eval/run_eval.py`. It reads `eval/questions.jsonl` (`id`, `arxiv_id`, `question`, `expected_pages`, optional `expected_answer`), retrieves the top-k chunks for the paper, and reports hit@k (any chunk starting on an expected page, optional `--slack`) and faithfulness (Gemini judge, yes/partial/no, using the existing `JUDGE_PROMPT`). Flags: `--k`, `--slack`, `--retrieval-only` (embeddings only, no answer or judge), `--limit`, `--sleep` (default 8 s to stay under the free-tier 15 requests/min), `--json`.
- Safety: read-only against the database; papers must already be added in the app and be ready (the script lists any that are not and exits with 2). It calls retrieval and Gemini directly, so it does not change user quotas or the global budget counter, but it does use real Gemini free-tier quota.
- Tested: invalid ID, paper missing from the database, retrieval-only, and a full run on one Attention question (hit@5 yes, faithfulness yes).
- Eval set: `backend/eval/questions.jsonl`, 20 questions (4 per paper) on Attention, LoRA, ResNet, the Bayesian Optimization tutorial and Green-Tao. Every expected page was found by searching the page text of the arXiv PDF, so it marks where the supporting sentence appears (several pages when the fact is repeated). Math questions ask about stated results, not formulas, because equations come out garbled from PDFs.
- First numbers (retrieval only, 12 questions on the 3 papers already in the database): hit@5 92% with slack 0, 100% with slack 1. These are optimistic: the papers are short (12 to 26 pages), so 5 chunks cover a large share of the pages. The full run (faithfulness) and the 2 remaining papers are still to do.
- Files / docs affected: `backend/eval/run_eval.py`, `backend/eval/questions.jsonl`, `docs/progress.md`.

### 2026-11-01 - Reference features batch 2 (frontend plus two small additive backend fields)
- What changed (backend, additive only): `PaperSummary.published` (optional, null for uploads) so the library can show a Year column; `PaperDetail.chunk_count` (optional, read-only count query, only for ready papers; a failed count returns null and never breaks the page). `BACKEND_SCHEMA.md` section 3 updated first. No schema change, no writes, no deletes.
- What changed (frontend): Year column; list/grid toggle (grid reuses `PaperCard`); `Ctrl K` hint in the filter box; "API 24ms" pill in the top bar (pings the public `/health` every 30 s while the tab is visible, shows "API offline" if it fails); chat answers show round-trip latency (measured in the browser, only for answers sent in this session) and source count; always-visible Prompts row above the chat input; Chunk Inspector "Copy BibTeX" (built from stored metadata in `lib/bibtex.ts`); graph lane labels (Foundations / Influenced with counts); compare "Diff highlights" (datasets and metrics shared by several papers fade, the rest get a ring), "Export matrix" (client-side `.md`), "Change papers" renamed "Switch papers"; paper page stat strip (Published, Chunks indexed, Field, Source).
- Left out on purpose: chunk count in the library list (needs one count query per paper on every poll, or a DB view/RPC which is a schema change, so it needs your approval), storage MB, Top-K and history sliders (touch the RAG pipeline), venue and abstract excerpt in the graph panel (needs a look at the cached S2 data).
- Checks: `tsc --noEmit` and `eslint src` clean; backend models and the new helper exercised with sample rows. Not yet clicked through in a browser.
- Files / docs affected: `docs/BACKEND_SCHEMA.md`, `backend/app/{models.py,routers/papers.py}`, `frontend/src/{types/api.ts,lib/{api,bibtex,download,compare-md}.ts,components/{api-status,app-header}.tsx,components/library/{library-view,paper-table,library-toolbar}.tsx,components/chat/{chat-panel,message-bubble,chunk-inspector,chat-session-view}.tsx,components/compare/{compare-view,compare-table}.tsx,components/graph/citation-graph.tsx,components/paper/paper-view.tsx}`.

### 2026-11-01 - UI redesign to match dark reference screenshots
- What changed: Dark is now the default theme (light toggle kept). New dark tokens (near-black bg, violet primary). Left sidebar shell plus top usage bar on desktop. Library, compare, chat workspace and citation graph restyled to the references, using only data the backend already returns.
- Skipped on purpose (needs new backend data or new features, build later): storage MB, embeddings cache %, chunk count and dim, publication year in the library list, live pipeline progress %, 10-paper cap and Upgrade flow, FastAPI latency and index name in the top bar, Sync Citations, Diff Highlights, Semantic Overlap, Export Matrix, complexity and benchmark sections in compare, Top-K and history sliders, chat latency and token meter, HNSW rank, Copy BibTeX, Clear Active Memory, citation velocity chart, venue and influence weight in the graph panel, Claim Account.
- Built: sidebar plus top usage bar (`app-sidebar.tsx`, `app-header.tsx`, `layout.tsx`); library stat cards, processing queue (from `status_step`) and paper table (`library-stats.tsx`, `processing-queue.tsx`, `paper-table.tsx`; `paper-card.tsx` is now unused except for its `CardSelection` type); 3-column workspace with a Chunk Inspector (`chunk-inspector.tsx`, `chat-panel.tsx` `onInspect`, `chat-session-view.tsx`); compare headings and numbered rows; graph minimap and wider node panel. Citation Graph has no sidebar entry because it lives inside each paper page.
- Checks: `tsc --noEmit` and `eslint src` clean. Not yet checked in a browser.
- Files / docs affected: `docs/UI_UX_DESIGN.md` 2.1, `frontend/src/{app/globals.css,app/layout.tsx}`, `components/{app-header,app-sidebar,theme-provider}.tsx`, `components/library/*`, `components/chat/*`, `components/compare/*`, `components/graph/*`.

### 2026-10-31 - UI additions: theme toggle, usage meter, library filters, onboarding, Ctrl+K, graph show more
- What changed: Header theme toggle (sun/moon, one click; removed the theme items from the Guest menu). `UsageMeter` ("7 of 10 papers left today") on the library and above the chat input, and `LimitBanner` when a daily limit is used up (copy from `UI_UX_DESIGN.md` section 6); the meters refetch through a `usage-changed` event that `api.ts` fires after a paper add, upload or chat message. Library toolbar (text filter on title/author, sort newest/oldest/title, status filter, "Showing x of n", "Clear filter"); it only shows with 2 or more papers. Dismissible onboarding hint (`localStorage`, never shown on the server render so it does not flash). Command palette (Ctrl/Cmd+K and a header search button) for pages, ready papers, chats and "Toggle dark mode"; lists load when it opens. Graph: "Show more" steps 12, 25, 50 per side (the backend `limit` max is 50) and only shows when a side came back full; node border strength follows the year (55% to 100% of the kind colour, year still printed); node width still follows citations.
- Notes: `components/ui/command.tsx` (this shadcn version) does not wrap `CommandDialog` children in `<Command>`, so the palette wraps them itself; without that cmdk throws "reading 'subscribe'". `json()` in `api.ts` already dispatched the usage event (added on disk by someone else), so I kept that and did not add a second dispatcher. `use-usage.ts` was overwritten by my version; same purpose.
- Observed: the daily paper limit in the running backend is 10, not the documented 5 (`DAILY_PAPER_LIMIT` is probably set in `backend/.env`). The meter reads it from the API, so it is correct either way.
- Dependencies added: `cmdk` (through shadcn `command`).
- Tested in a real browser (guest, real backend): toggle, hint dismiss and reload, meter went from 10 to 7 after 3 adds, filter/status/sort, Ctrl+K then type then Enter opens the paper, graph 25 to 51 nodes after Show more. Zero console errors, zero HTTP 400+.
- Not done yet (agreed, in this order): delete paper/chat with soft delete (30-day purge) and chat rename, compare "differences" line with cache, streaming chat.
- Files / docs affected: `frontend/src/components/{theme-toggle,command-palette,app-header}.tsx`, `components/usage/usage-meter.tsx`, `components/library/{library-toolbar,onboarding-hint,library-view}.tsx`, `components/chat/chat-panel.tsx`, `components/graph/{citation-graph,layout,paper-node}.tsx`, `hooks/{use-usage,use-dismissed}.ts`, `lib/api.ts`, `package.json`.

### 2026-10-31 - Tasks 2.6 to 2.9 multi-paper chat, compare, citation graph, export
- What changed: Library selection mode (Select button, checkboxes on ready papers only, max 3, sticky bar "N selected, Chat, Compare (2-3)"). `PaperSelector` dialog (min/max rules, resets on open). `/chat/[sessionId]` with a "Papers in this chat" list and a stable colour square plus letter per paper; source chips get that colour as a left border (`ChatPanel` and `MessageBubble` take `accentFor`). `/chats` list and "New chat" picker. `/compare?ids=a,b,c` with `CompareTable` (sticky first column, horizontal scroll on mobile) and "Chat about these". `CitationGraph` on the paper page (React Flow + dagre LR, custom node 140 to 220 px by log citations, legend, References/Citations/Both filter, side panel with "Open on Semantic Scholar" and "Add to library", "View as list" accessible version). `ExportButton` on the paper page and chat page (fetches with the auth header, then saves the file).
- Colours: no new colours. The 5 paper colours reuse `--primary`, `--graph-ref`, `--graph-cite`, `--success`, `--warning`; each is paired with a letter so colour is never the only cue. Graph node colour is the border plus a kind label in the aria-label.
- Decisions: the graph asks the backend for 12 nodes per side (`GRAPH_LIMIT`), because 20 per side made the labels unreadable; the graph is loaded with `next/dynamic` (`ssr: false`) and only mounts on its tab. "Chat" from the library or compare reuses the latest chat with exactly the same papers. `/chats` highlights in the header for `/chat/*` too.
- Dependencies added (user named them): `@xyflow/react`, `@dagrejs/dagre`; shadcn `dialog` and `table`.
- Tested in a real browser (guest, real backend): 3-paper chat with 16 chips in 3 distinct colours, chats list, picker, compare table (2 papers, no mobile overflow), chat-about-these, paper and chat `.md` downloads, graph with nodes and edges, side panel, filter, list view, light and dark. Zero console errors and zero HTTP 400+ responses.
- Not tested in the browser: clicking "Add to library" from a graph node (the button renders; the call is the same `addArxiv` used in the library), graph with no data, compare error state.
- Files / docs affected: `frontend/src/components/{library/paper-selector,library/paper-card,library/library-view,chat/chat-session-view,chat/chats-view,chat/chat-panel,compare/*,graph/*,export-button,paper/paper-view,app-header}.tsx`, `frontend/src/app/{chat/[sessionId],chats,compare}/page.tsx`, `frontend/src/lib/{api,open-chat,paper-colors}.ts`, `frontend/src/types/api.ts`, `frontend/package.json`.

### 2026-10-31 - Backend fix: 502 under parallel browser requests
- What changed: `backend/app/db.py` now passes a plain HTTP/1.1 `httpx.Client` (`http2=False`, 60 s timeout, pool of 50, keep-alive 10 s) to the Supabase client. `backend/app/auth.py` now logs the exception type and a short message (never the token) when token verification fails for a reason other than a bad token.
- Why: In the browser, `GET /api/chat/sessions` and `GET .../messages` returned 502 "Could not verify the session" after a page reload. The log showed `ReadError: [WinError 10035]`. supabase-py defaults to HTTP/2 with one shared connection, and the browser sends several requests at once, which hit that connection from different threads. My earlier tests were sequential, so they never showed it. After the change the full browser flow ran with no 502 and no console errors. Auth, table reads, storage and bad-token (401) were re-checked.
- Not re-run: upload to storage and the retry/delete paths (the first needs a Gemini-processed upload, the others are never executed by the agent).
- Burst limit: 20 per minute per IP was too tight for the UI. A processing paper polls every 4 s (15 requests per minute) and a reload sends about 5 requests. During the browser test the limit returned 429 twice. Changed the default to 60 per minute in `config.py`, `.env.example`, `TRD.md` (two places) and `BACKEND_SCHEMA.md`. The user set 60 in their own `backend/.env`. On Render, set `RATE_LIMIT_PER_MIN=60` too, or rely on the new code default.
- Files / docs affected: `backend/app/db.py`, `backend/app/auth.py`, `backend/app/config.py`, `backend/.env.example`, `docs/TRD.md`, `docs/BACKEND_SCHEMA.md`.

### 2026-10-31 - Tasks 2.1 to 2.5 frontend shell, library, paper page, chat
- What changed: Created the Next.js app in `frontend/` (Next 16.4.3, React 19, Tailwind 4, shadcn/ui radix base, Inter + Source Serif 4 + JetBrains Mono). Added `lib/supabase.ts` (lazy client, anonymous sign-in with a `captchaToken` hook), `lib/api.ts` (token, uniform error parsing, 401 re-sign-in once, cold-start toast after 5 s, burst vs daily 429 helpers), `types/api.ts`, the library page (`ArxivSearch`, `AddByIdInput`, `UploadDropzone`, `PaperCard`, `StatusBadge`, polling that pauses on hidden tabs), the paper page with `InsightsPanel`, and chat (`ChatPanel`, `MessageBubble`, `SourceChip`, `SourceDrawer`, suggested questions).
- Colours: `globals.css` holds only the tokens from `UI_UX_DESIGN.md` section 2.1. shadcn variable names point at them (`--card` is `--surface`, `--muted` and `--accent` are `--primary-soft`, `--primary-foreground` is `--surface` in light and `--background` in dark). No new colours. Status badges keep label text in the text colour and colour only the icon, because the success and warning tokens are below 4.5:1 on white for small text.
- Next 16 specifics: Cache Components is on, so `AppHeader` (uses `usePathname`) is inside `<Suspense>` in the layout and `/paper/[id]` awaits `params` inside a `<Suspense>` child. The Supabase client is created on first use so a build does not need env vars.
- Chat: answers render through `react-markdown` + `remark-math` + `rehype-katex` with the default URL sanitizer (no `rehype-raw`, no `dangerouslySetInnerHTML`). `[n]` becomes a `#cite-n` link only when source `n` exists, and the `a` renderer turns it into a `SourceChip`. A paper chat reuses the latest session that has exactly that paper, so a reload keeps the conversation.
- Not done yet: Turnstile, `UsageMeter` and `LimitBanner` (2.13a), graph tab (2.8), export button (2.9). The Library selection mode comes with 2.6.
- Dependencies added (pinned by `package-lock.json`): next-themes, @supabase/supabase-js, react-markdown, remark-math, rehype-katex, katex, and shadcn components (button, input, card, badge, tooltip, sheet, textarea, scroll-area, tabs, dropdown-menu, checkbox, skeleton, sonner, progress). `npm audit` reports 16 moderate findings from the scaffold; not changed, needs a decision.
- Files / docs affected: `frontend/` (new), `frontend/.env.example`, `frontend/.gitignore` (allows `.env.example`).

### 2026-10-31 - Task 1.18 render.yaml
- What changed: Added `render.yaml` at the repo root (Render reads blueprints from the root): web service `insightrag-api`, `rootDir: backend`, free plan, `PYTHON_VERSION=3.14.6`, `ENV=production`, start command with `--proxy-headers --forwarded-allow-ips='*'`, health check `/health`.
- Secrets (`GEMINI_API_KEY`, `SUPABASE_*`, model names, `S2_API_KEY`) use `sync: false`, so they are entered in the Render dashboard and are not in the file. `ALLOWED_ORIGINS` starts as `http://localhost:3000` and must be replaced with the Vercel URL after the frontend deploy.
- Fallback: if the build fails on 3.14, set `PYTHON_VERSION` to a 3.13.x version.
- Not deployed yet: needs the user to push the repo and create the service.
- Files / docs affected: `render.yaml`.

### 2026-10-31 - Task 1.17 Markdown export
- What changed: Added `export/markdown.py`, `app/routers/export.py`, and registered it in `main.py`. `GET /api/export/paper/{id}.md` and `GET /api/export/session/{id}.md` return `text/markdown` with `Content-Disposition: attachment`.
- Paper file: title, authors, date, arXiv link, abstract, then all insight fields. A paper without insights still exports, with a note instead of the insight sections.
- Chat file: title, paper list, each question as a heading, the answer, and a numbered source list (paper title, section, page).
- File names are an ASCII slug of the title (max 60 chars), so no user text reaches the header unescaped. Both routes need the paper or chat to belong to the caller (404 otherwise).
- Test data left: one more anonymous user pair, one chat session with one question on LoRA.
- Files / docs affected: `backend/export/`, `backend/app/routers/export.py`, `backend/app/main.py`.

### 2026-10-31 - Tasks 1.13 to 1.16 insights, compare, graph, search
- What changed: Added `insights/extractor.py`, `ingestion/s2_client.py`, `graph/builder.py`, `app/routers/compare.py`, `app/routers/arxiv.py`, and `GET /papers/{id}/graph` in `papers.py`. The pipeline now runs an `insights` step before `ready`.
- Insights: the prompt text is built from four priority groups (introduction, method, experiments or results, conclusion or discussion), each capped at 6,500 characters and matched by keyword because papers use custom section names, then other sections fill the rest of a 28,000 character budget. Appendix sections are skipped. One retry on invalid JSON; any failure returns `None` and the paper stays `ready` (chat works, compare does not). The same function uses the fallback model on 429. Known weakness: LoRA lists model names under datasets.
- Compare: plain read of stored insights, no LLM. Needs 2 to 3 different papers in the caller's library (404), all with insights (409 naming the titles).
- Graph: Semantic Scholar data is fetched once, ranked by citation count, trimmed to the top 50 per side and cached in `papers.s2_data` for 7 days (a no-match is cached too). Uploads are matched by title via `/paper/search/match` and accepted only at 0.92 title similarity or higher. The plain `/paper/search` endpoint answered 429 every time without an API key, so it is not used. A paper that is both a reference and a citation appears once. Without `S2_API_KEY` the shared limit can still return 429; the client retries twice, then returns 502.
- Search: `GET /api/arxiv/search` caches results per (query, max_results) for 10 minutes, max 200 entries, in memory. `in_library` is added per caller after the cache.
- Test data left: ResNet (1512.03385) paper and chunks, plus one more anonymous user with library rows.
- Files / docs affected: `backend/insights/`, `backend/graph/`, `backend/ingestion/s2_client.py`, `backend/app/routers/`.

### 2026-10-31 - Tasks 1.10 and 1.12a paper routes, quotas, rate limit
- What changed: Added `app/routers/papers.py` (`POST /papers/arxiv`, `POST /papers/upload`, `GET /papers`, `GET /papers/{id}`, `POST /papers/{id}/retry`, `DELETE /papers/{id}`), `app/routers/me.py` (`GET /me/usage`), `app/quota.py`, `app/limiter.py`. The pipeline now takes the title of an uploaded PDF from the parsed file (until then it is the filename).
- Quotas: counted from existing tables, so there is no schema change and they survive restarts. Papers per user: rows in `user_papers` added today. Messages per user: user messages today in the user's sessions. Global budget: assistant messages plus new papers created today, all users (one chat call per answer, one insights call per paper). Re-adding a paper already in the library is free. Limits are checked before any Gemini call and before storing an upload.
- Rate limit differs from the docs: `slowapi` is replaced by the `limits` library with an own middleware (`app/limiter.py`). Reason: slowapi's middleware finds the route handler to apply default limits, and with the current FastAPI nested routers it finds none, so the limit was silently skipped (6 requests passed with a limit of 4). The new version returned 429 with `Retry-After` on the 5th request. `requirements.txt` now lists `limits` instead of `slowapi`.
- Stuck papers: a paper in `processing` for more than 10 minutes is reported as `failed` with a retry message.
- Not run on purpose: `retry` (and re-adding a failed paper) clears old chunks, and `DELETE /papers/{id}` removes the library row. Both contain delete calls and were never executed against the database (AGENTS.md rule 3). Retry on a ready paper returns 400 before any delete.
- Test data left in Supabase (cannot be removed by the agent): papers LoRA, Attention, an uploaded Adam PDF and a 200-page failed upload, their chunks, about 6 anonymous users, library rows, 2 chat sessions and their messages. The 200-page test PDF is in the `uploads` bucket.
- Files / docs affected: `backend/app/`, `backend/requirements.txt`, `TRD.md`, `BACKEND_SCHEMA.md`, `IMPLEMENTATION_PLAN.md`.

### 2026-10-31 - Tasks 1.8, 1.9, 1.11, 1.12 embedding, pipeline, RAG chat, chat routes
- What changed: Added `app/gemini.py` (client, backoff, `generate` with fallback model), `rag/{embedder,prompts,retriever,chat}.py`, `ingestion/pipeline.py`, `app/routers/chat.py`, and registered the router under `/api` in `main.py`.
- Embedder: batches up to 100 texts or about 14K estimated tokens, and paces itself to 28K estimated tokens per rolling minute because the free tier allows about 30K embedding tokens per minute. A very long paper therefore takes minutes to embed. 429 and 5xx are retried with backoff.
- Fallback model: `generate` tries `GEMINI_CHAT_MODEL`, and on 429 or 5xx tries `GEMINI_FALLBACK_MODEL` once. Insights (1.13) will use the same function.
- Pipeline: parse, chunk, embed, then insert chunks only after all embeddings succeed, so a failure rarely leaves partial chunks. It never raises; failures set `status='failed'` with a readable `error`. Callers must clear old chunks before re-running a paper (the retry endpoint in 1.10 does this).
- Retriever: calls `match_chunks` per paper, skips chunks matching obvious injection phrases and logs only the chunk id.
- Chat routes: `POST/GET /api/chat/sessions`, `GET` and `POST /api/chat/sessions/{id}/messages`. Routes are plain `def`. Papers must be in the caller's library (404) and ready (409). The assistant message is only saved if generation succeeds, so a failed call leaves no orphan user message. `DELETE /api/chat/sessions/{id}` is not built yet.
- Not done yet: daily quotas and per-IP rate limit (1.12a). Chat is open to any signed-in user and spends Gemini quota until then.
- Files / docs affected: `backend/app/`, `backend/rag/`, `backend/ingestion/pipeline.py`.

### 2026-10-31 - Tasks 1.6, 1.7, 1.7a parser, chunker, sandbox
- What changed: Added `backend/parsers/{types,pdf_parser,worker,sandbox}.py` and `backend/rag/chunker.py` (plus `__init__.py` files).
- Parser rules: body font size = most common size; headings need heading style (bigger or bold) and a number or known name; LaTeX numbers on their own line are joined to the next heading line; sub-sections are labelled `Parent > Title`; ALL-CAPS headings are title-cased; header/footer = margin lines repeated on more than half the pages; rotated text and the arXiv side stamp are dropped; parsing stops at References and resumes at an Appendix heading; front matter before Abstract/Introduction is dropped; figure axis numbers and fragments under 20 chars or under 50% letters are dropped.
- Sandbox differs from `TRD.md` section 8.2: the worker sets its own memory and CPU limits at start (not `preexec_fn`, which is unsafe in a threaded server), receives only `max_pages`, memory and CPU as arguments, and gets a stripped environment so API keys never reach it. On Windows the memory and CPU caps are skipped (no `resource` module); the timeout and page limit still apply.
- Chunker: groups consecutive blocks by section, splits each group with `RecursiveCharacterTextSplitter`, prefixes `[title | section]`, drops chunks under 50 characters.
- Known limits: math is lost or garbled (as the PRD says); two-column order relies on PyMuPDF block order.
- Files / docs affected: `backend/parsers/`, `backend/rag/chunker.py`.

### 2026-10-31 - Task 1.5 arxiv_client
- What changed: Added `backend/ingestion/arxiv_client.py` (`normalize_id`, `get_metadata`, `search`, `download_pdf`) and `backend/tests/test_arxiv_client.py`.
- Notes: Functions are sync (the `arxiv` package blocks), so routes that call them should be plain `def`. `normalize_id` checks the year rule (4-digit number for 0704 to 1412, 5-digit from 1501) and accepts only arxiv.org links, so no user URL is ever fetched. `search` returns results without `in_library`; the router adds it. `download_pdf` is capped at `MAX_UPLOAD_MB` and checks the `%PDF-` signature. The test file needs `pytest`, which is not in `requirements.txt` yet.
- Files / docs affected: `backend/ingestion/`, `backend/tests/`.

### 2026-10-31 - Tasks 1.3 and 1.4 code
- What changed: Added `backend/app/auth.py` (`get_user_id` dependency) and `backend/app/models.py` (Pydantic models from `BACKEND_SCHEMA.md` section 3).
- Notes: Token is verified with `supabase.auth.get_user(token)`. Missing or invalid token returns `401 unauthorized`. Any other failure while verifying (network, Supabase down) returns `502 upstream_error`, so an outage is not shown as a login problem.
- Files / docs affected: `backend/app/auth.py`, `backend/app/models.py`.

### 2026-10-31 - Gemini free-tier limits
- What changed: Per-user daily limits 10 papers / 60 messages became 5 / 30. Added a global daily AI budget `GLOBAL_DAILY_AI_LIMIT=450` (chat + insights calls, all users, Postgres counter).
- Why: Chat model `gemini-3.5-flash-lite` has a free tier of 500 requests/day for the whole project. Embedding model has a separate 1K/day quota.
- Decisions: Fallback model is kept. `GEMINI_FALLBACK_MODEL` added to config and `.env.example`. The switch logic (try fallback when the chat model returns 429 or a quota error) is built in tasks 1.11 and 1.13 (`rag/chat.py`, `insights/extractor.py`). The global 450/day budget is counted per model, so with a fallback the combined budget can be higher.
- Files / docs affected: `TRD.md` (sections 6, 8.4), `BACKEND_SCHEMA.md` (limits table), `APP_FLOW.md` (sections 8, 9), `PRD.md` (F7.2), `UI_UX_DESIGN.md` (UsageMeter, microcopy), `IMPLEMENTATION_PLAN.md` (1.12a, checklist), `backend/app/config.py`, `backend/.env.example`.

### 2026-10-31 - Tasks 1.1 and 1.2 code
- What changed: Added `backend/sql/schema.sql` (copied from `BACKEND_SCHEMA.md` section 2), `backend/requirements.txt`, `backend/.env.example`, and `backend/app/` with `config.py`, `db.py`, `errors.py`, `main.py`.
- Why: Day 1 tasks 1.1 and 1.2.
- Notes: `errors.py` returns `reset_at: null` in the error body when not set. `/docs` and `/openapi.json` are off when `ENV=production`. `nosniff` header added via middleware.
- Files / docs affected: `backend/sql/`, `backend/app/`, `backend/requirements.txt`, `backend/.env.example`.

### 2026-10-31 - Repo structure and .gitignore
- What changed: Created `frontend/` and `backend/` (app/routers, ingestion, parsers, rag, insights, graph, export, eval, sql) with `.gitkeep` in empty backend folders. Added root `.gitignore`.
- Why: Match the structure in `IMPLEMENTATION_PLAN.md` section 1 and keep secrets out of git.
- Files / docs affected: `backend/**`, `frontend/`, `.gitignore`.

### 2026-10-31 - Docs organized
- What changed: Moved APP_FLOW, BACKEND_SCHEMA, PRD, TRD, UI_UX_DESIGN, IMPLEMENTATION_PLAN into `docs/`. Renamed `IMPLEMENTATION_PLAN(1).md` to `IMPLEMENTATION_PLAN.md`. Added `progress.md` and `changes.md`.
- Why: Keep the repo root clean and match the `/docs` folder the docs already refer to.
- Files / docs affected: all files in `docs/`.
