import re
import time
from difflib import SequenceMatcher

import httpx

from app.config import get_settings
from app.errors import AppError

BASE = "https://api.semanticscholar.org/graph/v1"
PAPER_FIELDS = "paperId,title,year,citationCount,externalIds"
KEEP = 50  # kept per side in the cache; equals the max `limit` of GET /papers/{id}/graph
FETCH = 1000  # fetched per side so we can rank by citation count before trimming
TITLE_MATCH = 0.92

_RETRY_WAIT = (1.5, 3.0)


def _headers() -> dict[str, str]:
    key = get_settings().s2_api_key
    return {"x-api-key": key} if key else {}


def _get(path: str, params: dict) -> dict | None:
    """GET from Semantic Scholar. None on 404. Retries 429 twice, then raises upstream_error."""
    for wait in (*_RETRY_WAIT, None):
        try:
            resp = httpx.get(f"{BASE}{path}", params=params, headers=_headers(), timeout=30)
        except httpx.HTTPError:
            raise AppError("upstream_error", "Semantic Scholar is not responding. Try again.")
        if resp.status_code == 404:
            return None
        if resp.status_code == 429 and wait is not None:
            time.sleep(wait)
            continue
        if resp.status_code != 200:
            raise AppError("upstream_error", "Semantic Scholar is not responding. Try again.")
        return resp.json()


def _norm(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


def find_paper(arxiv_id: str | None, title: str) -> dict | None:
    """arXiv papers by ID. Uploads by title search, accepted only on a close title match."""
    if arxiv_id:
        return _get(f"/paper/arXiv:{arxiv_id}", {"fields": PAPER_FIELDS})

    # /paper/search/match is built for title lookups and, unlike /paper/search, is usable without a key.
    data = _get("/paper/search/match", {"query": title[:200], "fields": PAPER_FIELDS})
    if not data or not data.get("data"):
        return None
    hit = data["data"][0]
    ratio = SequenceMatcher(None, _norm(title), _norm(hit.get("title") or "")).ratio()
    return hit if ratio >= TITLE_MATCH else None


def _top(entries: list[dict], key: str) -> list[dict]:
    papers = [e[key] for e in entries if e.get(key) and e[key].get("paperId") and e[key].get("title")]
    papers.sort(key=lambda p: p.get("citationCount") or 0, reverse=True)
    return papers[:KEEP]


def fetch_graph_data(arxiv_id: str | None, title: str) -> dict:
    """Raw data the graph is built from (this is what gets cached in papers.s2_data)."""
    paper = find_paper(arxiv_id, title)
    if paper is None:
        return {"paper": None, "references": [], "citations": []}

    params = {"fields": PAPER_FIELDS, "limit": FETCH}
    refs = _get(f"/paper/{paper['paperId']}/references", params) or {}
    cites = _get(f"/paper/{paper['paperId']}/citations", params) or {}
    return {
        "paper": paper,
        "references": _top(refs.get("data", []), "citedPaper"),
        "citations": _top(cites.get("data", []), "citingPaper"),
    }
