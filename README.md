# InsightRAG

Chat with research papers and get answers you can check. Add a paper from arXiv (or upload a PDF), ask questions, and every claim in the answer carries a numbered citation that opens the exact passage, section and page it came from.

> Status: backend and frontend are built and tested locally. Deployment, screenshots and a demo video are still to come.

## What it does

| Feature | Details |
|---|---|
| Add papers | Search arXiv, add by ID or URL, or upload a PDF (up to 20 MB and 100 pages) |
| Chat with citations | One paper or up to 5 at once. Citation chips open the source passage, with similarity score and a link to the PDF page |
| Auto insights | TL;DR, problem, method, datasets, metrics, key results, limitations, contributions |
| Compare | Side-by-side table for 2 or 3 papers, diff highlights, export as Markdown |
| Citation graph | References and citations from Semantic Scholar, with filters, list view and "add to library" |
| Export | Paper insights and chat sessions as Markdown, or as PDF through the browser's print dialog (clean light layout, no app chrome) |
| Guest first, account later | A guest session starts on its own, so the first screen is useful right away. Claim it with Google or email and password to keep your library and chats on any device, and log out or sign in again later |

## Evaluation

Measured with `backend/eval/run_eval.py` on 20 questions across 5 papers (4 per paper). Expected pages were found by searching the PDF text, so they mark where the supporting sentence appears.

| Metric | Result | Target |
|---|---|---|
| hit@5 (a retrieved chunk starts on an expected page) | 95% (19 of 20) | 75% |
| hit@5 with 1 page of slack | 100% (20 of 20) | 75% |
| Faithfulness (Gemini judge, every claim supported by the cited passages) | 100% yes (20 of 20) | 85% |

Papers: Attention Is All You Need, LoRA, ResNet, A Tutorial on Bayesian Optimization, and Green-Tao (primes contain arbitrarily long arithmetic progressions).

How to read these numbers:

- The only miss at slack 0 is a question whose answer starts on page 5 while the chunk is recorded on page 4. A chunk stores the page of its first block.
- The papers are short (12 to 56 pages) and the questions are fact lookups, so this is an easy set. It shows the pipeline works, not that it handles every paper.
- The judge is a Gemini model checking Gemini answers, so 100% should be read as "no obvious unsupported claims", not as proof.
- Math questions ask about stated results, not formulas, because PDF parsing garbles equations.

Rerun it after any change to chunk size, top-k or prompts:

```bash
cd backend
python eval/run_eval.py --retrieval-only      # embeddings only, no answer or judge calls
python eval/run_eval.py                       # full run, about 4 minutes on the free tier
python eval/run_eval.py --slack 1 --json out.json
```

The papers must already be in your database and ready. The script is read-only.

## Architecture

```
Browser (Next.js, Vercel)
   |  Supabase anonymous auth (JWT)
   v
FastAPI (Render)
   |-- ingestion: arXiv/PDF -> parse (isolated subprocess) -> chunk -> embed -> insights
   |-- rag: embed question -> per-paper top-k (pgvector) -> prompt -> cited answer
   |-- graph: Semantic Scholar -> cached in the papers table
   v
Supabase: Postgres + pgvector, Storage (uploads), Auth
Gemini API: chat model, embeddings
```

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router, TypeScript), Tailwind, shadcn/ui, React Flow + dagre, react-markdown + KaTeX |
| Backend | FastAPI, Pydantic v2 |
| Data | Supabase Postgres + pgvector, anonymous auth, Storage |
| AI | Google Gemini via `google-genai` (chat and embeddings; model names live in env) |
| PDF | PyMuPDF, parsed in a separate process with time, memory and page limits |
| Sources | arXiv API, Semantic Scholar Graph API |

## Design decisions

- **No full LangChain.** The pipeline is a few hundred lines (embed, SQL similarity, prompt). LangChain is used only for text splitting.
- **Per-paper retrieval.** Multi-paper chat takes top-k from each paper and merges, so one paper cannot crowd out the others.
- **Chunks never cross sections**, and each chunk keeps its section and page for citations.
- **Answers only from context.** If the passages do not contain the answer, the assistant says so. Paper text is treated as data, not instructions.
- **Shared papers.** A paper processed once is reused by everyone who adds it. Uploads stay private to the uploader.
- **Cost control.** Per-user daily limits, a global daily AI budget and a per-IP burst limit keep the free tiers safe.

## Limitations

- **Math is not rendered perfectly.** Formulas are read from the PDF's text layer, so symbols, fractions and subscripts can come out as plain or broken text in answers, insights and source snippets. For an exact formula, open the PDF from the source panel ("Jump to PDF source"). Cleaner math from arXiv HTML is on the roadmap.
- Accounts: claiming a guest session cannot link it to a Google account or email that is already registered (it is refused, then use Sign in). Signing in to an existing account copies the guest's papers and chats into it; a PDF the account already has is reused, not duplicated. The copy needs the guest session to be less than about an hour old, and it counts the copied items toward that day's quotas.
- No password reset or email change yet.
- Free-tier rate limits can slow processing when many people use it.
- The first request after idle is slow on the free host (cold start).
- Free-tier Gemini may use inputs to improve Google's models. Do not upload unpublished drafts.
- Uploaded PDFs are not virus-scanned. They are never executed or shared with other users.
- Scanned PDFs without a text layer are rejected (no OCR).

## Run it locally

You need Python 3.12 or newer, Node 20 or newer, a Supabase project and a Gemini API key.

1. **Database and auth.** In Supabase, run `backend/sql/schema.sql` and create a private `uploads` bucket. Under Authentication, turn on anonymous sign-ins, the Email provider and the Google provider (add the Google OAuth client ID and secret), turn on **Allow manual linking** (without it "Claim account" with Google fails), and add your site URL and `http://localhost:3000` to the redirect URLs.
2. **Backend.**
   ```bash
   cd backend
   python -m venv .venv && .venv\Scripts\activate      # source .venv/bin/activate on macOS/Linux
   pip install -r requirements.txt
   cp .env.example .env                                  # fill in the keys
   uvicorn app.main:app --reload
   ```
3. **Frontend.**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local                            # Supabase URL and anon key, API URL
   npm run dev
   ```
4. Open http://localhost:3000.

Only the anon key goes in the frontend. The service role key stays on the backend.

## Roadmap

- Streaming answers, quiz generator, reranker (if the eval calls for it)
- Password reset and email change
- PubMed and OpenAlex as extra sources
- Better math parsing from arXiv HTML
- Virus scanning for uploads, and Redis for shared rate limits when running several backend instances

## Docs

`docs/PRD.md`, `docs/TRD.md`, `docs/APP_FLOW.md`, `docs/UI_UX_DESIGN.md`, `docs/BACKEND_SCHEMA.md`, `docs/IMPLEMENTATION_PLAN.md`.
