

# InsightRAG - Progress

Tracks what is done and what is next. Update after every finished task. Task numbers match `IMPLEMENTATION_PLAN.md`.

**Last updated:** 2026-11-01

---

## Current status

- Built and working locally: backend 1.1 to 1.17, frontend 2.1 to 2.9, eval (2.11), mobile and accessibility pass (2.13), security headers (2.13a), dark redesign, PDF export, Google and email accounts with guest-data copy. 2.12 is skipped because the eval already beats the targets.
- Deployed 2026-11-01: API on Render (`https://insightrag-api.onrender.com`), frontend on Vercel (`https://insight-rag-puce.vercel.app`). Smoke test done by the user, app works.
- Left: securityheaders.com grade (user), Google and email provider setup in Supabase with a real-account test, UI PDF upload on the live Linux backend, finish README (2.14, needs screenshots and demo link), demo video (2.15). Turnstile is skipped for now (decision), so Supabase CAPTCHA stays off.
- Untested with real accounts: email claim, Google claim and sign-in, guest-data copy into a real account, uploaded-PDF move. Supabase "Allow manual linking" must be switched on first.
- Known quirk: the "API offline" pill can stay red in some browsers (it is the only call to `/health` without a token) while the app works. Left as is.
- `RATE_LIMIT_PER_MIN` is 60 (code default, `.env.example`, docs)
## Prep (Section 0)

- [ ] Semantic Scholar API key applied
- [x] Google AI Studio key created, model names noted (in use locally)
- [x] Supabase project created (URL, anon key, service role key) (in use locally)
- [ ] Cloudflare Turnstile widget created
- [x] Repo structure created (`frontend`, `backend`, `docs`)
- [x] Git repo initialized by user, `.gitignore` added
- [x] 5 eval papers picked: 1706.03762 (Attention), 2106.09685 (LoRA), 1512.03385 (ResNet), 1807.02811 (Bayesian Optimization tutorial), math/0404188 (Green-Tao)

## Day 1: Backend

| Task | Description | Status |
|---|---|---|
| 1.1 | Run schema.sql, anonymous sign-in, `uploads` bucket | Done (tables, function, triggers, vector ext verified) |
| 1.2 | FastAPI skeleton, config, db, errors, CORS, /health | Done (venv + install ok on Python 3.14.6, tests passed) |
| 1.3 | auth.py (`get_user_id`) | Done. No token and bad token return 401. Real anonymous token test still pending |
| 1.4 | models.py | Done (imports clean, copied from BACKEND_SCHEMA.md section 3) |
| 1.5 | arxiv_client.py | Done (ID formats, metadata, search, PDF download verified live) |
| 1.6 | pdf_parser.py | Done (tested on LoRA, Attention, Adam) |
| 1.7 | chunker.py | Done (chunks never cross sections, page of first block) |
| 1.7a | Sandboxed parsing (worker.py, sandbox.py) | Done (200-page, corrupted, non-PDF, empty all fail cleanly). Memory/CPU caps are Linux only |
| 1.8 | embedder.py | Done (batching, token pacing, backoff). Live test ok with `gemini-embedding-001` |
| 1.9 | pipeline.py | Done (LoRA paper: ready, 71 chunks, 8 s). Insights step comes in 1.13 |
| 1.10 | Paper routers | Done (add arXiv, upload, list, detail tested). Retry restart and `DELETE` paths are written but NOT run (they delete rows) |
| 1.11 | retriever, prompts, chat | Done (citation pages matched the PDF; off-topic question answered "not in the context") |
| 1.12 | Chat routers | Done (create/list sessions, get messages, send message). No delete endpoint yet. No quotas until 1.12a |
| 1.12a | Rate limits, quotas, usage endpoint | Done (user quotas, global budget, per-IP burst limit with Retry-After, `GET /api/me/usage`) |
| 1.13 | Insights extractor | Done (hooked into pipeline; insights backfilled for LoRA, Attention, Adam) |
| 1.14 | Compare endpoint | Done (3-paper table, 400/404/409 cases) |
| 1.15 | s2_client, graph builder, graph endpoint | Done (7-day cache in `papers.s2_data`; upload title match; no-match gives center only) |
| 1.16 | arXiv search endpoint | Done (10-min in-memory cache, `in_library` flag) |
| 1.17 | Markdown export | Done (paper and chat `.md` downloads; other user gets 404; no token gets 401) |
| 1.18 | Deploy backend to Render | Done (deployed with 2.10). `https://insightrag-api.onrender.com`, `/health` ok, CORS set to the Vercel URL, `/docs` off in production. Linux sandbox caps (memory, CPU) not yet tested with a bad PDF |

## Day 2: Frontend and ship

| Task | Description | Status |
|---|---|---|
| 2.1 | Theme, fonts, AppHeader, Toaster | Done (light, dark, mobile checked with screenshots; tokens only from UI_UX_DESIGN 2.1) |
| 2.2 | supabase.ts, api.ts, types | Done (guest sign-in and API calls tested in a real browser) |
| 2.3 | Library page | Done (empty state, Try this, arXiv search, ID validation, card Ready). Upload and failed-card retry NOT clicked in the browser |
| 2.4 | Paper page, InsightsPanel | Done (all 6 insight cards, TL;DR, header, arXiv link) |
| 2.5 | ChatPanel, MessageBubble, SourceDrawer | Done (answer with citation chips, KaTeX, drawer with PDF link at the right page, chat restored after reload, mobile 375 px no overflow) |
| 2.6 | Multi-paper chat, /chats | Done (3-paper chat, 3 chip colours, selection mode, picker, chats list) |
| 2.7 | Compare page | Done (table for 2 papers, sticky first column, Chat about these) |
| 2.8 | CitationGraph | Done (React Flow + dagre, filter, side panel, list view; 12 nodes per side). "Add to library" from a node not clicked in the browser |
| 2.9 | ExportButton | Done (paper and chat `.md` downloads) |
| 2.10 | Deploy frontend to Vercel | Done. `https://insight-rag-puce.vercel.app`. Response headers checked with curl (CSP built from the env vars, HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy). Live load in headless Chromium: guest sign-up and all API calls 200. securityheaders.com grade not recorded yet |
| 2.11 | Eval set and run_eval.py | Done. `run_eval.py` and `questions.jsonl` (20 questions, 5 papers). Full run: hit@5 95% (19 of 20, slack 0), 100% with slack 1; faithfulness 100% yes (20 of 20) |
| 2.12 | Fix worst eval failures | Skipped: hit@5 95% and faithfulness 100% already beat the targets (75% and 85%). Rerun the eval after any change to chunk size, top-k or prompts |
| 2.13 | Mobile and accessibility pass | Done (real browser audit at 375 and 1280 px on library, paper, chat tab, compare and chats: no horizontal overflow, 0 axe violations for WCAG 2.0/2.1 A and AA including contrast) |
| 2.13a | Security headers, UsageMeter, LimitBanner | Done. CSP and 4 other headers in `next.config.ts` (config checked for production and development; user ran `npm run build` and `npm start` locally and confirmed no CSP errors in the browser console). UsageMeter, LimitBanner, privacy footer, `/docs` off in production and no `rehype-raw` were already in place |
| 2.14 | README | Drafted at repo root (features, eval table, architecture, limitations, setup, roadmap). Still needs: screenshots, live URL, demo video link |
| 2.15 | Demo video | Not started |

## Manual test checklist (`IMPLEMENTATION_PLAN.md` section 4), run 2026-11-01

Run against throwaway backend instances (own ports, limits lowered through env vars, nothing in `.env` changed) with throwaway guest users, plus a real browser for the rendering check.

| Item | Result |
|---|---|
| Upload: text renamed to .pdf, wrong content type, renamed .exe, 25 MB file | All rejected with a clear message (400, 400, 400, 413) |
| Upload the same PDF twice | Same paper returned (200) |
| Corrupted PDF, 168-page PDF | Accepted, then `failed` with a readable reason; server stayed healthy |
| Valid uploaded PDF | Became ready, chat works with citations |
| Prompt injection | A line telling the assistant to answer only "BANANA" and ignore the user was ignored: correct summary, correct fact (412), no system prompt leak. An obvious phrase ("Ignore previous instructions") makes the retrieval filter drop the whole chunk (a one-chunk paper then answers "couldn't find anything") |
| Question not in the paper | "The provided context does not contain the answer" |
| Answer containing `<script>`, `<img onerror>`, `onmouseover`, `javascript:` link | Shown as text; nothing executed, no tags created, the link href is stripped (the link renders with an empty href) |
| Another user opens the upload, chat, exports, starts a chat on it, lists library | 404 everywhere, empty library; no token gives 401 |
| Paper limit | Over the limit gives 429 with a reset time; re-adding a paper already in the library is free |
| Message limit | 429 with a reset time (tested with the limit set to 0; same code path as the 31st message) |
| Global AI budget | Friendly 429 with a reset time |
| Burst limit | 7 requests ok, then 429 with `Retry-After` |
| Headers | API `nosniff`; frontend CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` present (dev server) |

Still open: Retry on a failed paper and Remove from library (both delete rows, the user runs them in the UI); compare with a paper that has no insights (409 message); graph "Add to library" and the no-data state; uploading through the UI; 150-page and corrupted PDFs on Linux (Render) where the memory and CPU caps apply; securityheaders.com after deploy; real-account sign-in tests.

Left in the database by these tests (not deleted): about 8 throwaway guest users, uploads "broken", "long" and two lighthouse test PDFs (each one a paper owned by a guest), and the "merge test" chat.

## Notes

- Python on dev machine: 3.14.6. Check that pymupdf, pydantic-core and supabase install cleanly on 3.14. If not, use 3.12 or 3.13 for the venv.
- Dev machine is Windows. The parsing sandbox uses Linux-only `resource` and `preexec_fn`, so it needs a fallback for local dev.
- Guardrails: see `AGENTS.md` (no git, plan first, no DB deletes, no critical actions without approval).

## Done log

- 2026-10-31: Created `frontend/` and `backend/` folder structure, `.gitignore`. User ran `git init`.
- 2026-10-31: Docs moved to `docs/`, `IMPLEMENTATION_PLAN(1).md` renamed to `IMPLEMENTATION_PLAN.md`, `progress.md` and `changes.md` created.
