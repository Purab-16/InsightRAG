"""Daily quotas, counted from existing tables so they survive restarts and need no extra schema.

Always call these before any Gemini call. All days are UTC and reset at 00:00 UTC.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.config import get_settings
from app.db import get_db
from app.errors import AppError
from app.models import Usage


def day_start() -> datetime:
    return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


def next_reset() -> datetime:
    return day_start() + timedelta(days=1)


def _count(query) -> int:
    return query.limit(1).execute().count or 0


def papers_used_today(user_id: UUID) -> int:
    return _count(
        get_db()
        .table("user_papers")
        .select("paper_id", count="exact")
        .eq("user_id", str(user_id))
        .gte("added_at", day_start().isoformat())
    )


def messages_used_today(user_id: UUID) -> int:
    return _count(
        get_db()
        .table("messages")
        .select("id,chat_sessions!inner(user_id)", count="exact")
        .eq("role", "user")
        .eq("chat_sessions.user_id", str(user_id))
        .gte("created_at", day_start().isoformat())
    )


def ai_calls_today() -> int:
    """All users combined: one chat call per answer, one insights call per new paper."""
    start = day_start().isoformat()
    db = get_db()
    answers = _count(
        db.table("messages").select("id", count="exact").eq("role", "assistant").gte("created_at", start)
    )
    papers = _count(db.table("papers").select("id", count="exact").gte("created_at", start))
    return answers + papers


def check_paper_quota(user_id: UUID) -> None:
    limit = get_settings().daily_paper_limit
    if papers_used_today(user_id) >= limit:
        raise AppError(
            "rate_limited",
            f"You've added {limit} papers today. You can add more after the daily reset.",
            reset_at=next_reset(),
        )


def check_message_quota(user_id: UUID) -> None:
    limit = get_settings().daily_message_limit
    if messages_used_today(user_id) >= limit:
        raise AppError(
            "rate_limited",
            f"You've used today's {limit} messages. Chat resets at the daily reset.",
            reset_at=next_reset(),
        )


def check_global_budget() -> None:
    if ai_calls_today() >= get_settings().global_daily_ai_limit:
        raise AppError(
            "rate_limited",
            "The free AI quota for today is used up. Try again after the daily reset.",
            reset_at=next_reset(),
        )


def usage(user_id: UUID) -> Usage:
    s = get_settings()
    return Usage(
        papers_used_today=papers_used_today(user_id),
        papers_limit=s.daily_paper_limit,
        messages_used_today=messages_used_today(user_id),
        messages_limit=s.daily_message_limit,
        reset_at=next_reset(),
    )
