import logging
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import AuthApiError

from app.db import get_db
from app.errors import AppError

logger = logging.getLogger(__name__)
bearer = HTTPBearer(auto_error=False)


def verify_token(token: str):
    """Verify a Supabase access token and return the Supabase user (has .id and .is_anonymous).

    Sync on purpose: the Supabase call blocks, so FastAPI runs the callers in a thread.
    """
    try:
        res = get_db().auth.get_user(token)
    except AuthApiError:
        raise AppError("unauthorized", "Invalid or expired token.")
    except Exception as e:
        # Log the type and message only (never the token) so outages can be told apart from bad tokens.
        logger.warning("Token verification failed: %s: %s", type(e).__name__, str(e)[:200])
        raise AppError("upstream_error", "Could not verify the session. Try again.")

    if res is None or res.user is None:
        raise AppError("unauthorized", "Invalid or expired token.")

    return res.user


def get_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> UUID:
    """Verify the Supabase access token and return the caller's user id."""
    if creds is None:
        raise AppError("unauthorized", "Missing access token.")
    return UUID(verify_token(creds.credentials).id)


def get_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    """Like get_user_id, but returns the whole Supabase user (needed to tell guests from accounts)."""
    if creds is None:
        raise AppError("unauthorized", "Missing access token.")
    return verify_token(creds.credentials)
