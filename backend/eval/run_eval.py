"""Retrieval and answer-quality eval (TRD section 10).

Run from anywhere:  python backend/eval/run_eval.py [options]

Each line of questions.jsonl:
  {"id": "attn-01", "arxiv_id": "1706.03762", "question": "...", "expected_pages": [4, 5],
   "expected_answer": "short reference answer, for humans reading the results"}

Metrics
  hit@k         any of the top-k retrieved chunks starts on an expected page (+/- --slack pages).
  faithfulness  a Gemini judge says whether every claim in the answer is supported by the cited
                passages: yes / partial / no. Reported as the share of "yes".

Notes
  - Read-only. The papers must already be in the database and ready (add them in the app first).
  - It calls retrieval and Gemini directly, so it does not touch user quotas or the app's global
    AI budget counter. It does use your real Gemini free-tier quota: use --retrieval-only to skip
    the answer and judge calls (embeddings only).
  - A chunk records the page of its first block, so an answer that continues onto the next page
    can look like a miss. Use --slack 1 to allow that and say so when you quote the numbers.
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)  # settings read backend/.env

from app.config import get_settings  # noqa: E402
from app.db import get_db  # noqa: E402
from app.errors import AppError  # noqa: E402
from app.gemini import generate  # noqa: E402
from ingestion.arxiv_client import normalize_id  # noqa: E402
from rag.chat import answer_question  # noqa: E402
from rag.embedder import embed_query  # noqa: E402
from rag.prompts import JUDGE_PROMPT  # noqa: E402
from rag.retriever import retrieve  # noqa: E402

REQUIRED = ("id", "arxiv_id", "question", "expected_pages")


def load_questions(path: Path) -> list[dict]:
    questions = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        q = json.loads(line)
        missing = [k for k in REQUIRED if k not in q]
        if missing:
            sys.exit(f"{path.name} line {number}: missing {', '.join(missing)}")
        try:
            q["arxiv_id"] = normalize_id(q["arxiv_id"])
        except AppError:
            sys.exit(f"{path.name} line {number}: {q['arxiv_id']!r} is not a valid arXiv ID")
        questions.append(q)
    return questions


def find_papers(arxiv_ids: set[str]) -> dict[str, dict]:
    rows = (
        get_db().table("papers").select("id,arxiv_id,title,status").in_("arxiv_id", sorted(arxiv_ids)).execute().data
    )
    return {r["arxiv_id"]: r for r in rows}


def judge(question: str, answer: str, sources_text: str) -> str:
    text = generate(
        JUDGE_PROMPT.format(question=question, answer=answer, sources_text=sources_text), temperature=0
    )
    word = re.match(r"\s*(yes|partial|no)\b", text, re.IGNORECASE)
    return word.group(1).lower() if word else "no"


def evaluate(q: dict, paper: dict, k: int, slack: int, retrieval_only: bool) -> dict:
    pid = paper["id"]
    result = {"id": q["id"], "paper": paper["title"], "expected_pages": q["expected_pages"]}
    emb = embed_query(q["question"])

    hits = retrieve(emb, [pid], top_k=k)
    pages = sorted({h.page for h in hits if h.page})
    result["retrieved_pages"] = pages
    result["hit"] = any(abs(p - e) <= slack for p in pages for e in q["expected_pages"])

    if retrieval_only:
        return result

    answer, sources = answer_question(q["question"], [pid], [])
    # answer_question numbers passages from its own retrieval (default top-k), so map [n] against that.
    chat_hits = hits if k == get_settings().top_k_per_paper else retrieve(emb, [pid])
    cited = [chat_hits[s.n - 1] for s in sources if 1 <= s.n <= len(chat_hits)] or chat_hits
    sources_text = "\n\n".join(f"[{i}] {h.content}" for i, h in enumerate(cited, start=1))
    result["answer"] = answer
    result["faithful"] = judge(q["question"], answer, sources_text)
    return result


def pct(part: int, whole: int) -> str:
    return f"{100 * part / whole:.0f}%" if whole else "n/a"


def main() -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--questions", type=Path, default=here / "questions.jsonl")
    ap.add_argument("--k", type=int, default=5, help="chunks per paper for hit@k (default 5)")
    ap.add_argument("--slack", type=int, default=0, help="pages of tolerance around an expected page")
    ap.add_argument("--retrieval-only", action="store_true", help="skip the answer and judge calls")
    ap.add_argument("--limit", type=int, help="only the first N questions")
    ap.add_argument("--sleep", type=float, help="seconds between questions (default 8, or 1 with --retrieval-only)")
    ap.add_argument("--json", type=Path, help="also write the per-question results to this file")
    args = ap.parse_args()

    if not args.questions.exists():
        sys.exit(f"No questions file at {args.questions}")
    questions = load_questions(args.questions)[: args.limit]
    if not questions:
        sys.exit("The questions file is empty.")

    papers = find_papers({q["arxiv_id"] for q in questions})
    problems = [
        f"  {a}: {'not in the database' if a not in papers else 'status ' + papers[a]['status']}"
        for a in sorted({q["arxiv_id"] for q in questions})
        if a not in papers or papers[a]["status"] != "ready"
    ]
    if problems:
        print("These papers must be added in the app and finish processing first:")
        print("\n".join(problems))
        return 2

    pause = args.sleep if args.sleep is not None else (1.0 if args.retrieval_only else 8.0)
    results = []
    for i, q in enumerate(questions):
        if i:
            time.sleep(pause)
        try:
            r = evaluate(q, papers[q["arxiv_id"]], args.k, args.slack, args.retrieval_only)
        except AppError as e:
            r = {"id": q["id"], "paper": papers[q["arxiv_id"]]["title"], "error": e.message}
        results.append(r)
        print(f"  done {q['id']}", flush=True)

    print()
    print(f"{'id':<14}{'hit@' + str(args.k):<8}{'faithful':<10}{'expected':<14}{'retrieved'}")
    print("-" * 70)
    for r in results:
        if "error" in r:
            print(f"{r['id']:<14}ERROR: {r['error']}")
            continue
        print(
            f"{r['id']:<14}{'yes' if r['hit'] else 'no':<8}{r.get('faithful', '-'):<10}"
            f"{','.join(map(str, r['expected_pages'])):<14}{','.join(map(str, r['retrieved_pages']))}"
        )

    scored = [r for r in results if "error" not in r]
    hits = sum(r["hit"] for r in scored)
    print("-" * 70)
    print(f"hit@{args.k}: {hits}/{len(scored)} = {pct(hits, len(scored))}  (slack {args.slack} page)")
    if not args.retrieval_only:
        judged = [r for r in scored if "faithful" in r]
        counts = {v: sum(r["faithful"] == v for r in judged) for v in ("yes", "partial", "no")}
        print(
            f"faithfulness: yes {counts['yes']}, partial {counts['partial']}, no {counts['no']}"
            f" of {len(judged)} = {pct(counts['yes'], len(judged))} yes"
        )
    errors = len(results) - len(scored)
    if errors:
        print(f"{errors} question(s) failed with an error and are not counted.")

    if args.json:
        args.json.write_text(json.dumps(results, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
