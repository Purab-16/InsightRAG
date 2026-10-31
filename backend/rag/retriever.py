import logging
import re
from dataclasses import dataclass
from uuid import UUID

from app.config import get_settings
from app.db import get_db

log = logging.getLogger("insightrag.retriever")

# Obvious prompt-injection phrases. Matching chunks are skipped and logged (ids only, never text).
_INJECTION = re.compile(
    r"ignore (all |any |the )?(previous|prior|above) (instructions|prompts?)"
    r"|disregard (all |any |the )?(previous|prior|above)"
    r"|reveal (your |the )?system prompt"
    r"|you are now (a|an|in)\b",
    re.IGNORECASE,
)


@dataclass
class Hit:
    chunk_id: UUID
    paper_id: UUID
    paper_title: str
    section: str | None
    page: int | None
    content: str  # chunk text without the "[title | section]" prefix
    similarity: float


def strip_prefix(content: str) -> str:
    """Remove the "[title | section]" line that the chunker puts in front of each chunk."""
    if content.startswith("[") and "]\n" in content[:500]:
        return content.split("]\n", 1)[1]
    return content


def retrieve(
    query_embedding: list[float], paper_ids: list[UUID], top_k: int | None = None
) -> list[Hit]:
    """Top-k chunks per paper, ordered by paper (session order) then similarity."""
    db = get_db()
    k = top_k or get_settings().top_k_per_paper

    ids = [str(p) for p in paper_ids]
    rows = db.table("papers").select("id,title").in_("id", ids).execute().data
    titles = {r["id"]: r["title"] for r in rows}

    hits: list[Hit] = []
    for pid in ids:
        res = db.rpc(
            "match_chunks",
            {"query_embedding": query_embedding, "target_paper": pid, "match_count": k},
        ).execute()
        for r in res.data:
            if _INJECTION.search(r["content"]):
                log.warning("skipped suspected injection chunk %s", r["id"])
                continue
            hits.append(
                Hit(
                    chunk_id=r["id"],
                    paper_id=r["paper_id"],
                    paper_title=titles.get(pid, "Unknown paper"),
                    section=r["section"],
                    page=r["page"],
                    content=strip_prefix(r["content"]),
                    similarity=r["similarity"],
                )
            )
    return hits
