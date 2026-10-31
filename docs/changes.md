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
