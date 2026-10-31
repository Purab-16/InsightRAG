from uuid import UUID

from fastapi import APIRouter, Depends

from app import quota
from app.auth import get_user_id
from app.db import get_db
from app.errors import AppError
from app.models import (
    CreateSessionRequest,
    Message,
    SendMessageRequest,
    SendMessageResponse,
    Session,
)
from rag.chat import HISTORY_MESSAGES, answer_question

# Plain `def` routes on purpose: the Supabase and Gemini clients block, so FastAPI runs them in a thread.
router = APIRouter(prefix="/chat", tags=["chat"])

TITLE_CHARS = 60


def _check_papers(paper_ids: list[UUID], user_id: UUID) -> None:
    """Every paper must be in the caller's library (404) and ready (409)."""
    db = get_db()
    ids = [str(p) for p in paper_ids]

    owned = (
        db.table("user_papers")
        .select("paper_id")
        .eq("user_id", str(user_id))
        .in_("paper_id", ids)
        .execute()
        .data
    )
    if len(owned) != len(ids):
        raise AppError("not_found", "Paper not found.")

    papers = db.table("papers").select("id,status").in_("id", ids).execute().data
    if any(p["status"] != "ready" for p in papers):
        raise AppError("not_ready", "Some papers are still processing.")


def _owned_session(session_id: UUID, user_id: UUID) -> dict:
    rows = (
        get_db()
        .table("chat_sessions")
        .select("*")
        .eq("id", str(session_id))
        .eq("user_id", str(user_id))
        .execute()
        .data
    )
    if not rows:
        raise AppError("not_found", "Chat not found.")
    return rows[0]


@router.post("/sessions", status_code=201, response_model=Session)
def create_session(body: CreateSessionRequest, user_id: UUID = Depends(get_user_id)):
    paper_ids = list(dict.fromkeys(body.paper_ids))  # drop duplicates, keep order
    _check_papers(paper_ids, user_id)

    row = (
        get_db()
        .table("chat_sessions")
        .insert(
            {
                "user_id": str(user_id),
                "title": body.title,
                "paper_ids": [str(p) for p in paper_ids],
            }
        )
        .execute()
        .data[0]
    )
    return Session.model_validate(row)


@router.get("/sessions")
def list_sessions(user_id: UUID = Depends(get_user_id)):
    rows = (
        get_db()
        .table("chat_sessions")
        .select("*")
        .eq("user_id", str(user_id))
        .order("updated_at", desc=True)
        .execute()
        .data
    )
    return {"sessions": [Session.model_validate(r) for r in rows]}


@router.get("/sessions/{session_id}/messages")
def get_messages(session_id: UUID, user_id: UUID = Depends(get_user_id)):
    session = _owned_session(session_id, user_id)
    rows = (
        get_db()
        .table("messages")
        .select("*")
        .eq("session_id", str(session_id))
        .order("created_at")
        .execute()
        .data
    )
    return {
        "session": Session.model_validate(session),
        "messages": [Message.model_validate(r) for r in rows],
    }


@router.post("/sessions/{session_id}/messages", response_model=SendMessageResponse)
def send_message(
    session_id: UUID, body: SendMessageRequest, user_id: UUID = Depends(get_user_id)
):
    db = get_db()
    session = _owned_session(session_id, user_id)
    paper_ids = [UUID(p) for p in session["paper_ids"]]
    _check_papers(paper_ids, user_id)
    quota.check_message_quota(user_id)  # before any Gemini call
    quota.check_global_budget()

    history = list(
        reversed(
            db.table("messages")
            .select("role,content")
            .eq("session_id", str(session_id))
            .order("created_at", desc=True)
            .limit(HISTORY_MESSAGES)
            .execute()
            .data
        )
    )

    answer, sources = answer_question(body.content, paper_ids, history)

    user_row = (
        db.table("messages")
        .insert({"session_id": str(session_id), "role": "user", "content": body.content})
        .execute()
        .data[0]
    )
    assistant_row = (
        db.table("messages")
        .insert(
            {
                "session_id": str(session_id),
                "role": "assistant",
                "content": answer,
                "sources": [s.model_dump(mode="json") for s in sources],
            }
        )
        .execute()
        .data[0]
    )

    # Any update fires the updated_at trigger; set the title from the first question if empty.
    db.table("chat_sessions").update(
        {"title": session["title"] or body.content[:TITLE_CHARS]}
    ).eq("id", str(session_id)).execute()

    return SendMessageResponse(
        user_message=Message.model_validate(user_row),
        assistant_message=Message.model_validate(assistant_row),
    )
