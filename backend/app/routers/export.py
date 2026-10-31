from uuid import UUID

from fastapi import APIRouter, Depends, Response

from app.auth import get_user_id
from app.db import get_db
from app.errors import AppError
from app.models import Message
from export.markdown import paper_to_markdown, session_to_markdown, slugify

router = APIRouter(prefix="/export", tags=["export"])


def _markdown_response(text: str, name: str) -> Response:
    return Response(
        content=text,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}.md"'},
    )


@router.get("/paper/{paper_id}.md")
def export_paper(paper_id: UUID, user_id: UUID = Depends(get_user_id)):
    db = get_db()
    owned = (
        db.table("user_papers")
        .select("paper_id")
        .eq("user_id", str(user_id))
        .eq("paper_id", str(paper_id))
        .execute()
        .data
    )
    if not owned:
        raise AppError("not_found", "Paper not found.")

    paper = db.table("papers").select("*").eq("id", str(paper_id)).execute().data[0]
    return _markdown_response(paper_to_markdown(paper), slugify(paper["title"], "paper"))


@router.get("/session/{session_id}.md")
def export_session(session_id: UUID, user_id: UUID = Depends(get_user_id)):
    db = get_db()
    rows = (
        db.table("chat_sessions")
        .select("*")
        .eq("id", str(session_id))
        .eq("user_id", str(user_id))
        .execute()
        .data
    )
    if not rows:
        raise AppError("not_found", "Chat not found.")
    session = rows[0]

    papers = db.table("papers").select("id,title").in_("id", session["paper_ids"]).execute().data
    by_id = {p["id"]: p for p in papers}
    ordered = [by_id[i] for i in session["paper_ids"] if i in by_id]

    messages = [
        Message.model_validate(r)
        for r in db.table("messages")
        .select("*")
        .eq("session_id", str(session_id))
        .order("created_at")
        .execute()
        .data
    ]
    return _markdown_response(
        session_to_markdown(session, ordered, messages), slugify(session.get("title") or "", "chat")
    )
