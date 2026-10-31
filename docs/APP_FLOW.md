# InsightRAG — App Flow

**Version:** 1.1 (security added) · **Date:** 2026-10-31 · **Related:** `PRD.md`, `UI_UX_DESIGN.md`

This document describes every user journey, screen transition and system state. Screens are defined in `UI_UX_DESIGN.md`; endpoints in `BACKEND_SCHEMA.md`.

---

## 1. Screen map

```
                         ┌───────────────────────┐
                         │  /  Library (home)    │
                         │  search · add · upload│
                         └───┬────────┬──────┬───┘
               open paper    │        │      │  "Compare"
                             ▼        │      ▼
               ┌──────────────────┐   │   ┌──────────────────┐
               │ /paper/[id]      │   │   │ /compare         │
               │ Insights tab     │   │   │ pick 2–3 → table │
               │ Chat tab         │   │   └──────────────────┘
               │ Graph tab        │   │ "New multi-paper chat"
               └───────┬──────────┘   ▼
                       │       ┌──────────────────────┐
     graph node with   │       │ /chat/[sessionId]    │
     arXiv ID → "Add"  │       │ multi-paper chat     │
     → back to Library │       └──────────────────────┘
                       ▼
               (paper added, processing)
```

Global header on every screen: logo (→ `/`), nav (Library, Chats, Compare), account chip (Guest / Sign in with Google — stretch).

## 2. First visit (anonymous auth)

1. User opens the app.
2. Frontend calls `supabase.auth.getSession()`.
3. No session → invisible Cloudflare Turnstile check runs → `supabase.auth.signInAnonymously({ options: { captchaToken } })` → session stored by Supabase client. (Turnstile shows an interactive challenge only if it suspects a bot.)
4. Frontend calls `GET /api/papers` with the token.
5. Library is empty → show **"Try these"** with 3 example arXiv papers + search bar focused.

**Returning visit:** session exists → step 4 directly → library shows the user's papers.

**Failure:** anonymous sign-in or CAPTCHA fails → full-page error "Couldn't start a session" + Retry button.

## 3. Add a paper

### 3.1 Via arXiv search
1. User types a query in the search bar, presses Enter (debounce 400 ms if search-as-you-type).
2. `GET /api/arxiv/search?q=...` → results list (title, authors, date, abstract preview, "Add" button; "In library" badge if already added).
3. User clicks **Add** → `POST /api/papers/arxiv {arxiv_id}`.
4. Response:
   - `200 ready` (already processed by someone) → card appears in library as **Ready**; toast "Added".
   - `202 processing` → card appears as **Processing**; polling starts (§3.4).

### 3.2 Via arXiv ID / URL
1. User pastes `2310.06825`, `2310.06825v2` or `https://arxiv.org/abs/2310.06825` in the "Add by ID" input.
2. Client-side check: looks like an arXiv ID or arXiv URL; otherwise inline error "Enter a valid arXiv ID or link".
3. Same as §3.1 step 3 onward.
4. `400 invalid_input` / `404 not_found` → inline error "arXiv paper not found".

### 3.3 Via PDF upload
1. User drags a PDF onto the dropzone or clicks to choose.
2. Client-side check: `.pdf` and ≤ 20 MB; else inline error.
3. `POST /api/papers/upload` (multipart) with upload progress bar.
4. Server checks: PDF signature (`%PDF-`), size, daily limit → `400` / `413` / `429` with inline error.
5. `202 processing` → card appears as **Processing**; polling starts. Parsing runs in a sandboxed process; a PDF that is too long (> 100 pages), broken, scanned or too slow to parse ends as **Failed** with the reason.
6. Same file uploaded again by the same user → `200 ready` with the existing paper (does not count toward the daily limit).

### 3.4 Processing and polling
```
processing ──(pipeline done)──▶ ready
     │
     ├──(any step fails)──────▶ failed (error message shown)
     │
     └──(> 10 min)────────────▶ treated as failed → Retry button
```
- Frontend polls `GET /api/papers/{id}` every 3 s while status is `processing` (stop polling when the page is hidden; resume on focus).
- Card shows a step hint if available: "Parsing… / Embedding… / Extracting insights…" (optional).
- On `ready`: toast "Paper ready", card becomes clickable.
- On `failed`: card shows the error + **Retry** (`POST /api/papers/{id}/retry`) and **Remove**.

### Backend pipeline (for reference)
```
download/receive PDF
  → (stretch: try arXiv HTML) → parse PDF
  → chunk (section-aware) → batch embed → insert chunks
  → extract insights (JSON) → save
  → status = ready
```

## 4. Single-paper flow (`/paper/[id]`)

1. User clicks a **Ready** paper card.
2. `GET /api/papers/{id}` → header (title, authors, date, arXiv link) + tabs.
3. **Insights tab (default):** TL;DR on top, then cards: Problem, Method, Datasets, Metrics, Key results, Limitations, Contributions, Field.
   - `insights = null` → message "Insights couldn't be generated for this paper. Chat still works."
4. **Chat tab:**
   1. First open → `POST /api/chat/sessions {paper_ids:[id]}` is created lazily on the first message (avoid empty sessions).
   2. Show 3 suggested questions: "Summarize the main idea", "What datasets and metrics are used?", "What are the limitations?".
   3. User sends a question → optimistic user bubble + "Thinking…" indicator.
   4. `POST /api/chat/sessions/{sid}/messages` → assistant bubble with `[n]` chips.
   5. Click `[n]` → Source drawer: paper title, section, page, snippet, "Open PDF at page" (arXiv PDF URL + `#page=X`).
5. **Graph tab:**
   1. `GET /api/papers/{id}/graph` (spinner; first call may take a few seconds).
   2. React Flow graph: references on the left, center paper, citations on the right.
   3. Hover node → tooltip (title, year, citations).
   4. Click node → side panel: title, year, citation count, "Open on Semantic Scholar", and **"Add to library"** if `arxiv_id` exists (→ §3.1 step 3).
   5. No data → "No citation data found for this paper."
6. **Export button** (header) → menu: "Insights (.md)" → `GET /api/export/paper/{id}.md`.

## 5. Multi-paper chat (`/chat/[sessionId]`)

1. Entry points: Library → select 2–5 ready papers (checkboxes) → **"Chat with selected"**; or Chats page → **New chat**.
2. `POST /api/chat/sessions {paper_ids}` → redirect to `/chat/{id}`.
3. Left panel: selected papers (title chips). Right: chat.
4. Ask → answer names which paper each point comes from, with `[n]` citations across papers.
5. Header: **Export chat (.md)** → `GET /api/export/session/{id}.md`.
6. Errors:
   - A paper not ready → `409` → toast "Some papers are still processing."
   - Rate limited → `429` → inline message "Too many requests — try again in a minute." + Retry on that message.

### Chats list (`/chats` — part of Library nav)
- `GET /api/chat/sessions` → list (title, paper count, date). Click → `/chat/{id}` → `GET .../messages`.

## 6. Compare (`/compare`)

1. User picks 2–3 ready papers (from library selector; papers without insights are disabled with tooltip).
2. **Compare** → `POST /api/compare {paper_ids}`.
3. Table: rows = fields (TL;DR, Problem, Method, Datasets, Metrics, Key results, Limitations, Contributions, Field), columns = papers.
4. Actions: "Chat about these papers" → creates a multi-paper session with the same IDs → `/chat/{id}`.
5. `409 not_ready` → message naming the paper(s) without insights.

## 7. Sign in with Google (stretch)

1. Header account chip shows **Guest**. Click → "Sign in with Google to keep your library on any device."
2. Supabase identity linking on the anonymous user → same `user_id`, data kept.
3. Chip shows user avatar/email. Sign out → new anonymous session (empty library).

## 8. Global error and edge states

| Situation | Behaviour |
|---|---|
| Backend cold start (first request slow) | Show skeleton + after 5 s: "Waking up the server, this can take up to a minute…" |
| `401` | Re-run anonymous sign-in once, retry request; still failing → error page |
| Network offline | Toast "You're offline"; disable send buttons |
| `502 upstream_error` | Toast "arXiv / Semantic Scholar / AI service is not responding. Try again." |
| `429` daily limit (papers or messages) | Inline banner with reset time from `reset_at`: "Daily limit reached (5 papers / 30 messages). Resets at {local time}." Send/Add buttons disabled until then |
| `429` burst limit (too many requests/min) | Toast "Slow down a little — try again in {Retry-After} s." |
| Unknown route | 404 page with link to Library |

## 9. Usage limits (shown to the user)

| Limit | Value | Where the user sees it |
|---|---|---|
| New papers (add or upload) per day | 5 | Library: "4 of 5 papers left today" under the add bar |
| Chat messages per day | 30 | Chat input footer: "25 of 30 messages left today" |
| PDF size | 20 MB | Upload dropzone hint |
| PDF length | 100 pages | Upload dropzone hint |

Remaining counts come from `GET /api/me/usage` (called on load and after each add/message).

## 10. Example end-to-end demo script (for the video)

1. Open app (no login) → empty library with "Try these".
2. Search "LoRA low-rank adaptation" → Add the paper → watch Processing → Ready.
3. Insights tab → Chat: "What are the limitations?" → click a citation → page shown.
4. Graph tab → click a reference with arXiv ID → Add to library.
5. Compare the two papers → table.
6. "Chat about these papers" → "How do their methods differ?" → cross-paper answer.
7. Export chat as Markdown.
