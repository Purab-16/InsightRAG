import re
from uuid import UUID

from google.genai import types

from app.gemini import generate
from app.models import Source
from rag.embedder import embed_query
from rag.prompts import CHAT_SYSTEM
from rag.retriever import Hit, retrieve

HISTORY_MESSAGES = 6
SNIPPET_CHARS = 200

NO_CONTEXT_ANSWER = (
    "I couldn't find anything in these papers to answer that. "
    "Try asking about the paper's method, datasets, results or limitations."
)


def _passage(n: int, hit: Hit) -> str:
    where = ", ".join(
        part for part in (hit.paper_title, hit.section, f"p.{hit.page}" if hit.page else None) if part
    )
    return f"[{n}] ({where}) {hit.content}"


def _contents(history: list[dict], question: str) -> list[types.Content]:
    contents = [
        types.Content(
            role="user" if m["role"] == "user" else "model",
            parts=[types.Part(text=m["content"])],
        )
        for m in history[-HISTORY_MESSAGES:]
    ]
    contents.append(types.Content(role="user", parts=[types.Part(text=question)]))
    return contents


def _sources(answer: str, hits: list[Hit]) -> list[Source]:
    used = sorted({int(n) for n in re.findall(r"\[(\d+)\]", answer)})
    return [
        Source(
            n=n,
            chunk_id=hits[n - 1].chunk_id,
            paper_id=hits[n - 1].paper_id,
            paper_title=hits[n - 1].paper_title,
            section=hits[n - 1].section,
            page=hits[n - 1].page,
            snippet=hits[n - 1].content[:SNIPPET_CHARS],
            similarity=round(hits[n - 1].similarity, 4),
        )
        for n in used
        if 1 <= n <= len(hits)
    ]


def answer_question(
    question: str, paper_ids: list[UUID], history: list[dict]
) -> tuple[str, list[Source]]:
    """RAG answer with citations. history is a list of {"role", "content"}, oldest first."""
    hits = retrieve(embed_query(question), paper_ids)
    if not hits:
        return NO_CONTEXT_ANSWER, []

    passages = "\n\n".join(_passage(i, h) for i, h in enumerate(hits, start=1))
    answer = generate(_contents(history, question), system=CHAT_SYSTEM.format(numbered_passages=passages))
    return answer, _sources(answer, hits)
