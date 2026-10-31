# InsightRAG - Progress

Tracks what is done and what is next. Update after every finished task. Task numbers match `IMPLEMENTATION_PLAN.md`.

**Last updated:** 2026-10-31

---

## Current status

- Phase: Day 1 backend, tasks 1.1 to 1.17 done (Checkpoints A and B reached, tested through the API with real anonymous users)
- Next task: 1.18 (deploy to Render, needs user approval)
## Prep (Section 0)

- [ ] Semantic Scholar API key applied
- [ ] Google AI Studio key created, model names noted
- [ ] Supabase project created (URL, anon key, service role key)
- [ ] Cloudflare Turnstile widget created
- [x] Repo structure created (`frontend`, `backend`, `docs`)
- [x] Git repo initialized by user, `.gitignore` added
- [ ] 5 eval papers picked

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
| 1.18 | Deploy backend to Render | In progress. `render.yaml` written (Python 3.14.6, fallback 3.13). Waiting for the user to push, create the service and set env vars |

## Day 2: Frontend and ship

| Task | Description | Status |
|---|---|---|
| 2.1 | Theme, fonts, AppHeader, Toaster | Not started |
| 2.2 | supabase.ts, api.ts, types | Not started |
| 2.3 | Library page | Not started |
| 2.4 | Paper page, InsightsPanel | Not started |
| 2.5 | ChatPanel, MessageBubble, SourceDrawer | Not started |
| 2.6 | Multi-paper chat, /chats | Not started |
| 2.7 | Compare page | Not started |
| 2.8 | CitationGraph | Not started |
| 2.9 | ExportButton | Not started |
| 2.10 | Deploy frontend to Vercel | Not started |
| 2.11 | Eval set and run_eval.py | Not started |
| 2.12 | Fix worst eval failures | Not started |
| 2.13 | Mobile and accessibility pass | Not started |
| 2.13a | Security headers, UsageMeter, LimitBanner | Not started |
| 2.14 | README | Not started |
| 2.15 | Demo video | Not started |

## Notes

- Python on dev machine: 3.14.6. Check that pymupdf, pydantic-core and supabase install cleanly on 3.14. If not, use 3.12 or 3.13 for the venv.
- Dev machine is Windows. The parsing sandbox uses Linux-only `resource` and `preexec_fn`, so it needs a fallback for local dev.
- Guardrails: see `AGENTS.md` (no git, plan first, no DB deletes, no critical actions without approval).

## Done log

- 2026-10-31: Created `frontend/` and `backend/` folder structure, `.gitignore`. User ran `git init`.
- 2026-10-31: Docs moved to `docs/`, `IMPLEMENTATION_PLAN(1).md` renamed to `IMPLEMENTATION_PLAN.md`, `progress.md` and `changes.md` created.
