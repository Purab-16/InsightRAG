# InsightRAG — Implementation Plan

**Version:** 1.1 (security added) · **Date:** 2026-10-31 · **Timeline:** 2 days · **Related:** all docs in `/docs`

Day 1 builds and deploys the backend; Day 2 builds the frontend and ships. Test every module before moving to the next.

---

## 0. Before you start (30 min, do tonight)

- [ ] Apply for a Semantic Scholar API key (approval can take time; app works without it).
- [ ] Create Google AI Studio API key; note the current free **Flash** chat model and **embedding** model names.
- [ ] Create Supabase project; note URL, anon key, service role key.
- [ ] Create a Cloudflare Turnstile widget (free); put the secret in Supabase Auth → Bot and Abuse Protection, keep the site key for the frontend.
- [ ] Create GitHub repo `insightrag` with `/frontend`, `/backend`, `/docs` (put these 6 docs in `/docs`).
- [ ] Pick 5 eval papers from arXiv across fields (e.g., 2 ML, 1 vision, 1 stats, 1 math). Save their IDs.

## 1. Repository structure

```text
insightrag/
├── docs/                      # PRD, TRD, APP_FLOW, UI_UX_DESIGN, BACKEND_SCHEMA, IMPLEMENTATION_PLAN
├── frontend/
│   ├── app/{page.tsx, paper/[id]/, chat/[sessionId]/, chats/, compare/}
│   ├── components/
│   ├── lib/{supabase.ts, api.ts}
│   └── types/api.ts
├── backend/
│   ├── app/{main.py, config.py, auth.py, db.py, errors.py, models.py, routers/}
│   ├── ingestion/{arxiv_client.py, s2_client.py, pipeline.py}
│   ├── parsers/{types.py, pdf_parser.py, worker.py, sandbox.py, html_parser.py}
│   ├── rag/{chunker.py, embedder.py, retriever.py, chat.py, prompts.py}
│   ├── insights/extractor.py
│   ├── graph/builder.py
│   ├── export/markdown.py
│   ├── eval/{questions.jsonl, run_eval.py}
│   ├── sql/schema.sql
│   └── requirements.txt
└── README.md
```

**`backend/requirements.txt`**
```text
fastapi
uvicorn[standard]
pydantic
pydantic-settings
python-multipart
httpx
google-genai
supabase
pymupdf
langchain-text-splitters
arxiv
limits              # was slowapi; see changes.md
beautifulsoup4      # stretch
```

**Frontend packages**
```bash
npx create-next-app@latest frontend --ts --tailwind --app
npx shadcn@latest init
npx shadcn@latest add button input card badge tabs dialog sheet table tooltip \
  checkbox dropdown-menu scroll-area textarea progress skeleton command sonner
npm i @supabase/supabase-js @xyflow/react @dagrejs/dagre react-markdown remark-math rehype-katex katex lucide-react @marsidev/react-turnstile
```

## 2. Day 1 — Backend

### Morning (~4 h): foundation + parsing

| # | Task | Done when |
|---|---|---|
| 1.1 | Run `schema.sql` in Supabase; enable anonymous sign-ins; create private bucket `uploads` | Tables + function visible |
| 1.2 | FastAPI skeleton: `config.py` (pydantic-settings), `db.py`, `errors.py` (uniform error handler), CORS, `/health` | `curl /health` → ok |
| 1.3 | `auth.py`: dependency `get_user_id` using `supabase.auth.get_user(token)` | Request without token → 401 |
| 1.4 | `models.py` from `BACKEND_SCHEMA.md` §3 | Imports cleanly |
| 1.5 | `arxiv_client.py`: `normalize_id`, `get_metadata`, `download_pdf`, `search` | Unit test on 5 ID formats |
| 1.6 | `parsers/pdf_parser.py` (section detection, header/footer strip, stop at References) | Script prints sections + pages for 3 papers, looks right |
| 1.7 | `rag/chunker.py` | Chunks never cross sections; prefix present |
| 1.7a | **Security:** `parsers/worker.py` + `parsers/sandbox.py` (subprocess, timeout, memory cap, 100-page limit, text cap) | A 200-page PDF and a corrupted PDF both fail cleanly; API stays up |

**Checkpoint A:** parse + chunk 3 papers locally and eyeball output.

### Afternoon (~4 h): ingestion + chat

| # | Task | Done when |
|---|---|---|
| 1.8 | `rag/embedder.py`: batching, task types, `EMBED_DIM`, backoff | 100 chunks embed without 429 crash |
| 1.9 | `ingestion/pipeline.py`: parse → chunk → embed → insert → (insights later) → ready; `status_step` updates; failure handling | Paper reaches `ready` |
| 1.10 | Routers: `POST /papers/arxiv`, `POST /papers/upload` (+ Storage), `GET /papers`, `GET /papers/{id}`, `DELETE`, `POST /retry` | Add same paper twice → second is instant |
| 1.11 | `rag/retriever.py` + `rag/prompts.py` + `rag/chat.py` | — |
| 1.12 | Chat routers: create/list sessions, get messages, send message | 5 questions on one paper, citations' pages match the PDF |
| 1.12a | **Security:** per-IP limit (`limits`), daily quotas (papers, messages) checked before Gemini calls, `GET /api/me/usage`, `<context>` prompt guard | 6th paper and 31st message return `429` with `reset_at`; global budget (450/day) also returns `429` |

**Checkpoint B:** single-paper and 2-paper chat work from curl/Postman with correct pages.

### Evening (~4 h): insights, compare, graph, export, deploy

| # | Task | Done when |
|---|---|---|
| 1.13 | `insights/extractor.py` (structured output, retry, null fallback) + hook into pipeline | `insights` JSON saved for 3 papers |
| 1.14 | `POST /compare` | Table JSON for 3 papers |
| 1.15 | `ingestion/s2_client.py` + `graph/builder.py` + `GET /papers/{id}/graph` with 7-day cache | Graph JSON with refs + citations |
| 1.16 | `GET /arxiv/search` with 10-min cache | Results with `in_library` |
| 1.17 | `export/markdown.py` + export routes | `.md` downloads look clean |
| 1.18 | Deploy backend to Render (env vars, start command with `--proxy-headers`), disable `/docs` in production, strict CORS | Deployed `/health` and one chat work |

**Checkpoint C (end of Day 1):** deployed backend, chat with correct citations. If behind, cut 1.15–1.17 to Day 2 morning and drop stretch.

**Stretch (only if Checkpoint C is done early):** `parsers/html_parser.py` with PDF fallback.

## 3. Day 2 — Frontend + ship

### Morning (~4 h): app shell + library + paper page

| # | Task | Done when |
|---|---|---|
| 2.1 | Theme tokens (`UI_UX_DESIGN.md` §2), fonts, `AppHeader`, Toaster | Shell renders light + dark |
| 2.2 | `lib/supabase.ts` (Turnstile + anonymous sign-in on load) + `lib/api.ts` (token, error parsing, cold-start notice, 429 handling) + `types/api.ts` | `GET /papers` works from browser |
| 2.3 | Library: `ArxivSearch`, `AddByIdInput`, `UploadDropzone`, `PaperCard`, `StatusBadge`, polling, empty state with "Try these" | Add → processing → ready visible |
| 2.4 | Paper page: header, tabs, `InsightsPanel` | Insights render |
| 2.5 | `ChatPanel`, `MessageBubble` (markdown + KaTeX + `[n]` → `SourceChip`), `SourceDrawer`, suggested questions | Ask + click citation shows page |

### Afternoon (~4 h): multi-paper, compare, graph, export

| # | Task | Done when |
|---|---|---|
| 2.6 | Library selection mode + `PaperSelector` + `/chat/[sessionId]` + `/chats` | 3-paper chat works, paper colours on chips |
| 2.7 | `/compare` + `CompareTable` + "Chat about these" | Table for 3 papers |
| 2.8 | `CitationGraph` (React Flow + dagre LR, custom node, legend, filter, side panel, "Add to library", list view) | Graph interactive; add from node works |
| 2.9 | `ExportButton` on paper page and chat page | Files download |

**Fallback:** if 2.8 is not done by mid-afternoon, ship the list view only and move the graph to v2.

### Evening (~4 h): ship

| # | Task | Done when |
|---|---|---|
| 2.10 | Deploy frontend to Vercel; set `ALLOWED_ORIGINS` on Render | Public URL works in incognito |
| 2.11 | Write `eval/questions.jsonl` (15–20 Qs) + `run_eval.py`; run on deployed or local backend | hit@5 and faithfulness numbers |
| 2.12 | Fix the 2–3 worst failures (chunk size, top-k, prompt); rerun eval | Numbers improved or understood |
| 2.13 | Mobile pass (375 px) + accessibility quick check (focus, contrast, aria-labels on chips) | No broken layouts |
| 2.13a | **Security:** security headers + CSP in `next.config`, `UsageMeter` + `LimitBanner`, privacy note, confirm no `rehype-raw` / `dangerouslySetInnerHTML` | securityheaders.com shows headers; limits visible in UI |
| 2.14 | README: pitch, screenshots/GIF, architecture diagram, eval table, design decisions, limitations, roadmap, setup steps | README complete |
| 2.15 | Record 2–3 min demo video (script in `APP_FLOW.md` §9) | Linked in README |

**Stretch:** "Sign in with Google" with identity linking.

## 4. Manual test checklist (before calling it done)

- [ ] Incognito visit → no login → library empty state.
- [ ] Add by ID (plain, versioned, URL) and via search.
- [ ] Add a paper someone already added → instant ready.
- [ ] Upload a PDF; upload same PDF again → same paper.
- [ ] Upload a non-PDF / 25 MB file → clear errors.
- [ ] Failed paper shows reason + Retry works.
- [ ] Single chat: citation page matches the PDF (check 3 answers).
- [ ] Ask something not in the paper → "not in the paper" answer.
- [ ] Multi-paper chat names papers correctly.
- [ ] Chat history persists after refresh.
- [ ] Compare 3 papers; paper without insights shows 409 message.
- [ ] Graph loads; add-from-node works; no-data state works.
- [ ] Both exports download and read well.
- [ ] Another browser (new anonymous user) cannot see the first user's uploads or chats.
- [ ] 150-page PDF, corrupted PDF and a renamed `.exe` → clean failures, server stays up.
- [ ] A PDF containing "ignore previous instructions…" does not change assistant behaviour.
- [ ] 6th new paper / 31st message in a day → friendly limit message with reset time.
- [ ] Global daily AI budget reached → friendly "service limit" message with reset time.
- [ ] Rapid-fire requests → `429` with `Retry-After`.
- [ ] Answer containing `<script>` text renders as plain text, not executed.
- [ ] Response headers include CSP, `nosniff`, `frame-ancestors 'none'`.
- [ ] Mobile 375 px usable; dark mode readable.

## 5. Working with AI coding tools

1. Put all 6 docs in `/docs`; tell the tool to read the relevant doc before each task.
2. One prompt = one task row above, e.g. *"Implement task 1.6 per TRD.md §4.1 and BACKEND_SCHEMA.md §6. Include a script that parses 3 PDFs and prints sections with pages."*
3. `BACKEND_SCHEMA.md` is the contract: generate Pydantic models and `frontend/types/api.ts` from it.
4. Test each task (curl, script, browser) before the next prompt.
5. If a contract must change, update the doc first, then code.
6. Never paste secrets into prompts; keep `.env*` in `.gitignore`.

## 6. Time budget summary

| Block | Hours | Output |
|---|---|---|
| Prep (tonight) | 0.5 | Keys, repo, eval papers |
| Day 1 morning | 5 | Skeleton, auth, arXiv, parser, chunker, sandboxed parsing |
| Day 1 afternoon | 4.5 | Embed, ingest, chat, rate limits + quotas |
| Day 1 evening | 4 | Insights, compare, graph, search, export, deploy |
| Day 2 morning | 4 | Shell, library, paper page, chat UI |
| Day 2 afternoon | 4 | Multi-chat, compare, graph, export UI |
| Day 2 evening | 4.5 | Deploy, eval, polish, security headers, README, video |
| **Total** | **~26.5** | v1 shipped |

Security adds ~2 hours. If time runs short, keep sandboxed parsing, quotas and CAPTCHA (they protect the deployed app); headers and the injection-phrase filter can wait.
