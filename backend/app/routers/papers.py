import hashlib
import re
from datetime import datetime, timedelta, timezone
from pathlib import PurePath
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, Response, UploadFile
from postgrest import APIError as PostgrestError

from app import quota
from app.auth import get_user_id
from app.config import get_settings
from app.db import get_db
from app.errors import AppError
from app.models import (
    AddArxivRequest,
    AddPaperResponse,
    GraphResponse,
    PaperDetail,
    PaperSummary,
)
from graph.builder import build_graph
from ingestion.arxiv_client import get_metadata, normalize_id
from ingestion.pipeline import process_paper

# Plain `def` routes on purpose: the Supabase and arXiv clients block, so FastAPI runs them in a thread.
router = APIRouter(prefix="/papers", tags=["papers"])

STUCK_AFTER = timedelta(minutes=10)
STUCK_MESSAGE = "Processing took too long. Retry to start again."
UNIQUE_VIOLATION = "23505"


# ───────────── helpers ─────────────


def _is_stuck(paper: dict) -> bool:
    if paper["status"] != "processing":
        return False
    updated = datetime.fromisoformat(paper["updated_at"])
    return datetime.now(timezone.utc) - updated > STUCK_AFTER


def _needs_restart(paper: dict) -> bool:
    return paper["status"] == "failed" or _is_stuck(paper)


def _summary_fields(row: dict) -> dict:
    """Fields shared by PaperSummary and PaperDetail. A stuck paper is reported as failed."""
    paper = row["papers"]
    stuck = _is_stuck(paper)
    return {
        "id": paper["id"],
        "title": paper["title"],
        "authors": paper["authors"],
        "source": paper["source"],
        "arxiv_id": paper["arxiv_id"],
        "status": "failed" if stuck else paper["status"],
        "status_step": None if stuck else paper["status_step"],
        "added_at": row["added_at"],
    }


def _library_row(user_id: UUID, paper_id: UUID) -> dict:
    rows = (
        get_db()
        .table("user_papers")
        .select("added_at,papers(*)")
        .eq("user_id", str(user_id))
        .eq("paper_id", str(paper_id))
        .execute()
        .data
    )
    if not rows:
        raise AppError("not_found", "Paper not found.")
    return rows[0]


def _add_to_library(user_id: UUID, paper_id: str) -> None:
    get_db().table("user_papers").upsert(
        {"user_id": str(user_id), "paper_id": paper_id},
        on_conflict="user_id,paper_id",
        ignore_duplicates=True,
    ).execute()


def _reset_paper(paper_id: str) -> None:
    """Prepare a failed or stuck paper for another run: clear old chunks and the error."""
    db = get_db()
    db.table("chunks").delete().eq("paper_id", paper_id).execute()
    db.table("papers").update(
        {"status": "processing", "status_step": None, "error": None}
    ).eq("id", paper_id).execute()


def _in_library(user_id: UUID, paper_id: str) -> bool:
    rows = (
        get_db()
        .table("user_papers")
        .select("paper_id")
        .eq("user_id", str(user_id))
        .eq("paper_id", paper_id)
        .execute()
        .data
    )
    return bool(rows)


def _find_arxiv_paper(arxiv_id: str) -> dict | None:
    rows = (
        get_db()
        .table("papers")
        .select("id,status,updated_at")
        .eq("arxiv_id", arxiv_id)
        .execute()
        .data
    )
    return rows[0] if rows else None


def _existing_arxiv_response(
    paper: dict, user_id: UUID, tasks: BackgroundTasks, response: Response
) -> AddPaperResponse:
    _add_to_library(user_id, paper["id"])
    if _needs_restart(paper):
        _reset_paper(paper["id"])
        tasks.add_task(process_paper, paper["id"])
        response.status_code = 202
        return AddPaperResponse(paper_id=paper["id"], status="processing")
    response.status_code = 200 if paper["status"] == "ready" else 202
    return AddPaperResponse(paper_id=paper["id"], status=paper["status"])


# ───────────── routes ─────────────


@router.post("/arxiv", response_model=AddPaperResponse)
def add_arxiv(
    body: AddArxivRequest,
    tasks: BackgroundTasks,
    response: Response,
    user_id: UUID = Depends(get_user_id),
):
    arxiv_id = normalize_id(body.arxiv_id)

    existing = _find_arxiv_paper(arxiv_id)
    if existing:
        # Re-adding a paper that is already in the library is free.
        if not _in_library(user_id, existing["id"]):
            quota.check_paper_quota(user_id)
        if _needs_restart(existing):
            quota.check_global_budget()
        return _existing_arxiv_response(existing, user_id, tasks, response)

    quota.check_paper_quota(user_id)
    quota.check_global_budget()
    meta = get_metadata(arxiv_id)  # 404 if arXiv has no such paper
    try:
        paper = (
            get_db()
            .table("papers")
            .insert(
                {
                    "source": "arxiv",
                    "arxiv_id": arxiv_id,
                    "title": meta.title,
                    "authors": meta.authors,
                    "abstract": meta.abstract,
                    "published": meta.published.isoformat(),
                    "categories": meta.categories,
                    "pdf_url": meta.pdf_url,
                }
            )
            .execute()
            .data[0]
        )
    except PostgrestError as e:
        if e.code != UNIQUE_VIOLATION:
            raise
        # Someone else added the same paper a moment ago: treat it as existing.
        return _existing_arxiv_response(_find_arxiv_paper(arxiv_id), user_id, tasks, response)

    _add_to_library(user_id, paper["id"])
    tasks.add_task(process_paper, paper["id"])
    response.status_code = 202
    return AddPaperResponse(paper_id=paper["id"], status="processing")


@router.post("/upload", response_model=AddPaperResponse)
def upload_pdf(
    tasks: BackgroundTasks,
    response: Response,
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_user_id),
):
    s = get_settings()
    db = get_db()

    if file.content_type != "application/pdf":
        raise AppError("invalid_input", "Only PDF files are supported.")

    limit = s.max_upload_mb * 1024 * 1024
    data = file.file.read(limit + 1)
    if len(data) > limit:
        raise AppError("file_too_large", f"PDF must be {s.max_upload_mb} MB or smaller.")
    if not data.startswith(b"%PDF-"):
        raise AppError("invalid_input", "This file is not a valid PDF.")

    digest = hashlib.sha256(data).hexdigest()
    existing = (
        db.table("papers")
        .select("id,status")
        .eq("source", "upload")
        .eq("uploaded_by", str(user_id))
        .eq("content_hash", digest)
        .execute()
        .data
    )
    if existing:
        _add_to_library(user_id, existing[0]["id"])
        response.status_code = 200
        return AddPaperResponse(paper_id=existing[0]["id"], status=existing[0]["status"])

    quota.check_paper_quota(user_id)  # before storing anything
    quota.check_global_budget()

    # The filename is only a provisional title; it never reaches a storage path.
    stem = re.sub(r"[^\w\s.\-()]", "", PurePath(file.filename or "").stem)[:200].strip()
    paper_id = str(uuid4())

    db.storage.from_("uploads").upload(
        f"{user_id}/{paper_id}.pdf", data, {"content-type": "application/pdf"}
    )
    db.table("papers").insert(
        {
            "id": paper_id,
            "source": "upload",
            "uploaded_by": str(user_id),
            "content_hash": digest,
            "title": stem or "Untitled upload",
        }
    ).execute()
    _add_to_library(user_id, paper_id)

    tasks.add_task(process_paper, paper_id)
    response.status_code = 202
    return AddPaperResponse(paper_id=paper_id, status="processing")


@router.get("")
def list_papers(user_id: UUID = Depends(get_user_id)):
    rows = (
        get_db()
        .table("user_papers")
        .select("added_at,papers(*)")
        .eq("user_id", str(user_id))
        .order("added_at", desc=True)
        .execute()
        .data
    )
    return {"papers": [PaperSummary(**_summary_fields(r)) for r in rows]}


@router.get("/{paper_id}", response_model=PaperDetail)
def get_paper(paper_id: UUID, user_id: UUID = Depends(get_user_id)):
    row = _library_row(user_id, paper_id)
    paper = row["papers"]
    fields = _summary_fields(row)
    return PaperDetail(
        **fields,
        abstract=paper["abstract"],
        published=paper["published"],
        categories=paper["categories"],
        pdf_url=paper["pdf_url"],
        parse_source=paper["parse_source"],
        error=STUCK_MESSAGE if _is_stuck(paper) else paper["error"],
        insights=paper["insights"],
    )


@router.get("/{paper_id}/graph", response_model=GraphResponse)
def get_graph(
    paper_id: UUID,
    limit: int = Query(20, ge=5, le=50),
    user_id: UUID = Depends(get_user_id),
):
    paper = _library_row(user_id, paper_id)["papers"]
    return build_graph(paper, limit)


@router.post("/{paper_id}/retry", status_code=202, response_model=AddPaperResponse)
def retry_paper(
    paper_id: UUID, tasks: BackgroundTasks, user_id: UUID = Depends(get_user_id)
):
    paper = _library_row(user_id, paper_id)["papers"]
    if not _needs_restart(paper):
        raise AppError("invalid_input", "Only failed papers can be retried.")
    quota.check_global_budget()
    _reset_paper(paper["id"])
    tasks.add_task(process_paper, paper["id"])
    return AddPaperResponse(paper_id=paper["id"], status="processing")


@router.delete("/{paper_id}", status_code=204)
def remove_paper(paper_id: UUID, user_id: UUID = Depends(get_user_id)):
    """Remove from the caller's library only; the shared paper and its chunks stay."""
    _library_row(user_id, paper_id)
    get_db().table("user_papers").delete().eq("user_id", str(user_id)).eq(
        "paper_id", str(paper_id)
    ).execute()
    return Response(status_code=204)
