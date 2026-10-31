import time
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.auth import get_user_id
from app.db import get_db
from app.errors import AppError
from app.models import ArxivResult
from ingestion.arxiv_client import ArxivMeta, search

router = APIRouter(prefix="/arxiv", tags=["arxiv"])

CACHE_SECONDS = 600
CACHE_MAX_ENTRIES = 200

# (query, max_results) -> (expires_at, results). In memory: per backend instance, lost on restart.
_cache: dict[tuple[str, int], tuple[float, list[ArxivMeta]]] = {}


def _cached_search(q: str, max_results: int) -> list[ArxivMeta]:
    key = (q.lower(), max_results)
    now = time.monotonic()

    hit = _cache.get(key)
    if hit and hit[0] > now:
        return hit[1]

    results = search(q, max_results)

    for k in [k for k, (exp, _) in _cache.items() if exp <= now]:
        del _cache[k]
    while len(_cache) >= CACHE_MAX_ENTRIES:
        del _cache[min(_cache, key=lambda k: _cache[k][0])]  # drop the oldest
    _cache[key] = (now + CACHE_SECONDS, results)
    return results


def _in_library_ids(user_id: UUID, arxiv_ids: list[str]) -> set[str]:
    if not arxiv_ids:
        return set()
    rows = (
        get_db()
        .table("user_papers")
        .select("papers!inner(arxiv_id)")
        .eq("user_id", str(user_id))
        .in_("papers.arxiv_id", arxiv_ids)
        .execute()
        .data
    )
    return {r["papers"]["arxiv_id"] for r in rows}


@router.get("/search")
def search_arxiv(
    q: str = Query(..., max_length=200),
    max_results: int = Query(10, ge=1, le=25),
    user_id: UUID = Depends(get_user_id),
):
    q = q.strip()
    if not q:
        raise AppError("invalid_input", "Enter something to search for.")

    results = _cached_search(q, max_results)
    owned = _in_library_ids(user_id, [r.arxiv_id for r in results])
    return {
        "results": [
            ArxivResult(
                arxiv_id=r.arxiv_id,
                title=r.title,
                authors=r.authors,
                abstract=r.abstract,
                published=r.published,
                categories=r.categories,
                in_library=r.arxiv_id in owned,
            )
            for r in results
        ]
    }
