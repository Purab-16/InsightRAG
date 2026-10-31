import re
from dataclasses import dataclass
from datetime import date
from urllib.parse import urlparse

import arxiv
import httpx

from app.config import get_settings
from app.errors import AppError

# New style: YYMM.NNNN (0704 to 1412) or YYMM.NNNNN (1501 onward).
# Old style: hep-th/9901001.
_NEW_ID = re.compile(r"^(\d{4})\.(\d{4,5})$")
_OLD_ID = re.compile(r"^[a-z]+(?:-[a-z]+)*(?:\.[A-Za-z]{2})?/\d{7}$")
_VERSION = re.compile(r"v\d+$")

_USER_AGENT = "InsightRAG/0.1 (research paper assistant)"

_client = arxiv.Client(page_size=25, delay_seconds=3.0, num_retries=2)


@dataclass
class ArxivMeta:
    arxiv_id: str
    title: str
    authors: list[str]
    abstract: str
    published: date
    categories: list[str]
    pdf_url: str


def _is_new_style(value: str) -> bool:
    match = _NEW_ID.match(value)
    if not match:
        return False
    yymm, number = int(match.group(1)), match.group(2)
    if not 1 <= yymm % 100 <= 12:
        return False
    return len(number) == (4 if yymm <= 1412 else 5)


def normalize_id(raw: str) -> str:
    """Return the bare arXiv ID without version, or raise invalid_input.

    Accepts: 2310.06825, 2310.06825v3, arXiv:2310.06825, hep-th/9901001,
    and arxiv.org /abs/ or /pdf/ links. Nothing else is ever fetched, so a
    user cannot make the server request an arbitrary URL.
    """
    value = (raw or "").strip()

    if value.lower().startswith("arxiv:"):
        value = value[6:].strip()

    if "://" in value or value.lower().startswith(("arxiv.org", "www.arxiv.org")):
        parsed = urlparse(value if "://" in value else f"https://{value}")
        if parsed.hostname not in ("arxiv.org", "www.arxiv.org"):
            raise AppError("invalid_input", "Enter a valid arXiv ID or link.")
        match = re.match(r"^/(?:abs|pdf)/(.+?)(?:\.pdf)?/?$", parsed.path)
        if not match:
            raise AppError("invalid_input", "Enter a valid arXiv ID or link.")
        value = match.group(1)

    value = _VERSION.sub("", value)

    if not (_is_new_style(value) or _OLD_ID.match(value)):
        raise AppError("invalid_input", "Enter a valid arXiv ID or link.")
    return value


def _to_meta(result: arxiv.Result) -> ArxivMeta:
    return ArxivMeta(
        arxiv_id=_VERSION.sub("", result.get_short_id()),
        title=" ".join(result.title.split()),
        authors=[a.name for a in result.authors],
        abstract=" ".join(result.summary.split()),
        published=result.published.date(),
        categories=list(result.categories),
        pdf_url=result.pdf_url,
    )


def get_metadata(arxiv_id: str) -> ArxivMeta:
    """Fetch metadata for a normalized ID. Raises not_found if arXiv has no such paper."""
    try:
        results = list(_client.results(arxiv.Search(id_list=[arxiv_id])))
    except Exception:
        raise AppError("upstream_error", "arXiv is not responding. Try again.")
    if not results:
        raise AppError("not_found", "arXiv paper not found.")
    return _to_meta(results[0])


def search(q: str, max_results: int = 10) -> list[ArxivMeta]:
    try:
        results = _client.results(
            arxiv.Search(
                query=q,
                max_results=max_results,
                sort_by=arxiv.SortCriterion.Relevance,
            )
        )
        return [_to_meta(r) for r in results]
    except Exception:
        raise AppError("upstream_error", "arXiv is not responding. Try again.")


def download_pdf(arxiv_id: str) -> bytes:
    """Download the PDF for a normalized ID. The URL is built from the ID only."""
    limit = get_settings().max_upload_mb * 1024 * 1024
    url = f"https://arxiv.org/pdf/{arxiv_id}"
    try:
        with httpx.stream(
            "GET",
            url,
            headers={"User-Agent": _USER_AGENT},
            follow_redirects=True,
            timeout=60,
        ) as resp:
            if resp.status_code == 404:
                raise AppError("not_found", "arXiv paper not found.")
            if resp.status_code != 200:
                raise AppError("upstream_error", "Could not download the PDF from arXiv.")
            data = bytearray()
            for chunk in resp.iter_bytes():
                data.extend(chunk)
                if len(data) > limit:
                    raise AppError("file_too_large", "PDF is too large.")
    except AppError:
        raise
    except Exception:
        raise AppError("upstream_error", "Could not download the PDF from arXiv.")

    if not data.startswith(b"%PDF-"):
        raise AppError("upstream_error", "arXiv did not return a PDF.")
    return bytes(data)
