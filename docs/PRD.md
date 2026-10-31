# InsightRAG — Product Requirements Document (PRD)

**Version:** 1.1 (security added) · **Date:** 2026-10-31 · **Status:** Approved for v1 build (2 days)

---

## 1. Summary

InsightRAG is a research paper assistant. Users bring papers from arXiv (search or ID) or upload a PDF, then chat with one or many papers with page-level citations, compare 2–3 papers side by side, explore a citation graph, and export their work as Markdown.

**Tagline:** Bring any arXiv paper, chat with it, compare it, understand it.

**Goal now:** a portfolio-grade project that works end to end.
**Goal later:** a product real students and researchers use.

## 2. Problem

1. Research papers are long; reading one fully takes hours.
2. Comparing several papers (methods, datasets, results) is manual and slow.
3. The connections between papers (who cites whom) are hard to see.
4. Generic chatbots answer from memory and hallucinate; users cannot verify claims.

## 3. Target users

| Persona | Need | Example |
|---|---|---|
| Student (UG/PG) doing a literature review | Understand papers fast, compare them for a report | "Which of these 3 papers works best on low-resource data?" |
| Early researcher | Find related work, check claims against the source | "On which page do they report the ablation?" |
| Engineer reading ML papers | Get method + results without reading 30 pages | "What is the core idea and what are the limits?" |

**Domain focus:** tech, science and math papers (CS, ML, physics, statistics, math) — all available on arXiv.

## 4. Goals and non-goals

### Goals (v1)
- A user can go from "topic in mind" to "chatting with a paper" in under 1 minute (excluding processing time).
- Every answer cites the paper, section and page it came from.
- Comparing 2–3 papers needs zero extra LLM calls at request time.
- No login wall: the app works immediately for a first-time visitor.

### Non-goals (v1)
- PubMed, OpenAlex or other sources.
- Email/password or Google login as a requirement (Google sign-in is stretch only).
- PDF export, quiz generation, reranking, streaming answers.
- Perfect math rendering from PDFs.
- Collaboration / sharing between users.

## 5. Scope

| Tier | Features |
|---|---|
| **v1 (must ship)** | arXiv search, add by arXiv ID, PDF upload, single-paper chat, multi-paper chat, citations (paper + section + page), chat history, auto insights, compare table, interactive citation graph, Markdown export, anonymous auth, eval set |
| **Stretch** | arXiv HTML parsing with PDF fallback, "Sign in with Google" (links anonymous account) |
| **v2** | PDF export, reranker, quiz generator (5 MCQ/paper), PubMed/OpenAlex, full auth flows, streaming |

**Scope freeze rule:** any new idea during the v1 build goes to the roadmap, not the code.

## 6. Functional requirements

### F1. Find and add papers
| ID | Requirement | Priority |
|---|---|---|
| F1.1 | User can search arXiv by keyword and see title, authors, date, abstract | P0 |
| F1.2 | User can add a paper by arXiv ID or arXiv URL (with or without version suffix) | P0 |
| F1.3 | User can upload a PDF (max 20 MB) | P0 |
| F1.4 | A paper already processed by anyone is added instantly (no re-processing) | P0 |
| F1.5 | User sees processing status: processing / ready / failed (with reason) | P0 |
| F1.6 | User can remove a paper from their library | P1 |
| F1.7 | Empty library shows 3 "Try these" example papers | P1 |

### F2. Chat
| ID | Requirement | Priority |
|---|---|---|
| F2.1 | User can chat with one paper | P0 |
| F2.2 | User can chat with 2–5 papers at once; answers say which paper each point is from | P0 |
| F2.3 | Every factual claim carries a numbered citation; clicking it shows paper, section, page and snippet | P0 |
| F2.4 | If the answer is not in the papers, the assistant says so instead of guessing | P0 |
| F2.5 | Chat sessions and messages are saved and listed | P0 |
| F2.6 | Math in answers renders (LaTeX) | P1 |

### F3. Understand and compare
| ID | Requirement | Priority |
|---|---|---|
| F3.1 | Each ready paper shows auto insights: TL;DR, problem, method, datasets, metrics, key results, limitations, contributions, field | P0 |
| F3.2 | User can compare 2–3 papers in a side-by-side table built from insights | P0 |

### F4. Citation graph
| ID | Requirement | Priority |
|---|---|---|
| F4.1 | Each paper shows an interactive graph of top references and citations | P0 |
| F4.2 | Clicking a node opens it on Semantic Scholar, or adds it to the library if it has an arXiv ID | P1 |

### F5. Export
| ID | Requirement | Priority |
|---|---|---|
| F5.1 | User can download a paper's insights as Markdown | P0 |
| F5.2 | User can download a chat session (Q&A + sources) as Markdown | P0 |

### F6. Accounts
| ID | Requirement | Priority |
|---|---|---|
| F6.1 | First visit signs the user in anonymously; their library and chats persist in that browser | P0 |
| F6.2 | User can sign in with Google and keep their existing data | Stretch |

### F7. Safety and fair use
| ID | Requirement | Priority |
|---|---|---|
| F7.1 | Bots cannot mass-create anonymous accounts (invisible CAPTCHA on first sign-in) | P0 |
| F7.2 | Per-user daily limits: 5 paper adds/uploads, 30 chat messages; global daily AI-call budget (450); per-IP burst limit | P0 |
| F7.3 | A malformed or malicious PDF cannot crash or hang the server; it just fails with a clear message | P0 |
| F7.4 | PDFs over 100 pages are rejected with a clear message | P0 |
| F7.5 | Text inside papers cannot change the assistant's behaviour (prompt-injection resistant) | P0 |
| F7.6 | User sees a friendly message and the reset time when a limit is reached | P0 |

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Cost | Runs fully on free tiers (Gemini, Supabase, Vercel, Render) |
| Latency | Chat answer p50 < 6 s on a warm server; arXiv search < 3 s |
| Processing | A 20-page paper is ready in < 90 s (free-tier rate limits allowing) |
| Accuracy | Retrieval hit@5 ≥ 75% and faithfulness ≥ 85% on the eval set |
| Security | API keys only on the backend; every request authenticated; users see only their own library, chats and uploads; PDFs parsed in an isolated subprocess with time/memory limits; rate limits and CAPTCHA against abuse; security headers on the frontend; strict CORS (see `TRD.md` §8) |
| Privacy | Uploaded PDFs visible only to the uploader; README warns that free-tier Gemini may use inputs to improve Google's models |
| Responsiveness | Usable on a 375 px wide phone; designed for desktop |

## 8. Success metrics

**Portfolio (v1):**
- Deployed, public link works for a first-time visitor without login.
- README shows eval numbers (hit@5, faithfulness) and a 2–3 min demo video.
- All P0 requirements pass a manual test run.

**Product (later):**
- Weekly active users, papers added per user, questions per session.
- % of answers where users open a citation (trust signal).
- Return rate after 7 days.

## 9. Assumptions and constraints

- Build time: 2 days, one developer using AI coding tools.
- Gemini free tier: ~15 requests/minute for Flash models (check AI Studio for current numbers); Pro models are not free.
- Model names change; they live in config, not code.
- Semantic Scholar works without a key but with shared, lower limits.
- Render free instances sleep when idle (cold start 30–60 s).

## 10. Known limitations (to state in README)

- Math equations can be garbled by PDF parsing.
- Free-tier rate limits can slow processing when many users are active.
- First request after idle is slow (cold start).
- Free-tier Gemini may use inputs for model improvement — do not upload unpublished drafts.
- Uploaded PDFs are not virus-scanned in v1. They are never executed and never shared with other users, so the risk is limited; scanning is on the roadmap.

## 11. Roadmap (v2)

1. Full auth flows (email, Google) and account linking polish
2. PDF export
3. Reranker (if eval hit@k is low)
4. Quiz generator (5 MCQ per paper)
5. PubMed / OpenAlex sources
6. Better math parsing from arXiv HTML (if not done in stretch)
7. Streaming answers (SSE)
8. Virus scanning for uploads (ClamAV as a separate service)
9. Redis (e.g. Upstash) for shared rate limits, caching and a job queue when running multiple backend instances

## 12. Related documents

- `TRD.md` — technical requirements and architecture
- `APP_FLOW.md` — user flows and screen transitions
- `UI_UX_DESIGN.md` — screens, components, design system
- `BACKEND_SCHEMA.md` — database schema and API contracts
- `IMPLEMENTATION_PLAN.md` — 2-day build order
