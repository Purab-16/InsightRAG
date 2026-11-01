"""Copy a guest's library, uploads and chats into the account the guest just signed in to.

Rules: only inserts and updates, never deletes (a failed merge cannot lose data, and running it again
finishes the job). The guest's own rows are left in place, so the library is copied, not stolen.
"""

import logging
from uuid import UUID

from postgrest import APIError as PostgrestError

from app.db import get_db
from app.models import MergeGuestResponse

log = logging.getLogger("insightrag.merge")
UNIQUE_VIOLATION = "23505"
BUCKET = "uploads"


def _move_upload(paper_id: str, guest: str, account: str) -> None:
    """Move the stored PDF to the new owner's folder. Safe to repeat: a missing source is fine if it already moved."""
    storage = get_db().storage.from_(BUCKET)
    src, dst = f"{guest}/{paper_id}.pdf", f"{account}/{paper_id}.pdf"
    try:
        storage.move(src, dst)
    except Exception:
        if not storage.exists(dst):
            raise


def _move_uploads(guest: str, account: str) -> tuple[int, dict[str, str]]:
    """Give the account the guest's uploaded PDFs. Returns (moved, {guest paper id: account paper id} for duplicates)."""
    db = get_db()
    moved = 0
    replaced: dict[str, str] = {}
    uploads = (
        db.table("papers").select("id,content_hash").eq("source", "upload").eq("uploaded_by", guest).execute().data
    )
    for paper in uploads:
        twin = (
            db.table("papers")
            .select("id")
            .eq("source", "upload")
            .eq("uploaded_by", account)
            .eq("content_hash", paper["content_hash"])
            .execute()
            .data
        )
        if twin:
            # The account already has this exact PDF: use its copy instead of creating a second one.
            replaced[paper["id"]] = twin[0]["id"]
            continue
        try:
            _move_upload(paper["id"], guest, account)
            db.table("papers").update({"uploaded_by": account}).eq("id", paper["id"]).execute()
            moved += 1
        except PostgrestError as e:
            if e.code != UNIQUE_VIOLATION:
                log.warning("upload %s not moved: %s", paper["id"], e.message)
                continue
            log.warning("upload %s already exists on the account; skipped", paper["id"])
        except Exception as e:
            # One broken file must not stop the rest of the merge; it stays with the guest and can be retried.
            log.warning("upload %s not moved: %s: %s", paper["id"], type(e).__name__, str(e)[:200])
    return moved, replaced


def _copy_library(guest: str, account: str, replaced: dict[str, str]) -> int:
    db = get_db()
    have = {
        r["paper_id"] for r in db.table("user_papers").select("paper_id").eq("user_id", account).execute().data
    }
    rows = db.table("user_papers").select("paper_id,added_at").eq("user_id", guest).execute().data
    copied = 0
    for row in rows:
        target = replaced.get(row["paper_id"], row["paper_id"])
        if target in have:
            continue
        db.table("user_papers").upsert(
            {"user_id": account, "paper_id": target, "added_at": row["added_at"]},
            on_conflict="user_id,paper_id",
            ignore_duplicates=True,
        ).execute()
        have.add(target)
        copied += 1
    return copied


def _move_chats(guest: str, account: str, replaced: dict[str, str]) -> int:
    db = get_db()
    sessions = db.table("chat_sessions").select("id,paper_ids").eq("user_id", guest).execute().data
    for s in sessions:
        paper_ids = list(dict.fromkeys(replaced.get(p, p) for p in s["paper_ids"]))
        db.table("chat_sessions").update({"user_id": account, "paper_ids": paper_ids}).eq("id", s["id"]).execute()
    return len(sessions)


def merge_guest_into_account(guest_id: UUID, account_id: UUID) -> MergeGuestResponse:
    guest, account = str(guest_id), str(account_id)
    uploads_moved, replaced = _move_uploads(guest, account)
    papers_copied = _copy_library(guest, account, replaced)
    chats_moved = _move_chats(guest, account, replaced)
    log.info("merged guest %s into account %s", guest, account)
    return MergeGuestResponse(papers_copied=papers_copied, uploads_moved=uploads_moved, chats_moved=chats_moved)
