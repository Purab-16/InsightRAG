from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import AuthApiError

from app.db import get_db
from app.errors import AppError

bearer = HTTPBearer(auto_error=False)


def get_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> UUID:
    """Verify the Supabase access token and return the caller's user id.

    Sync on purpose: the Supabase call blocks, so FastAPI runs this in a thread.
    """
    if creds is None:
        raise AppError("unauthorized", "Missing access token.")

    try:
        res = get_db().auth.get_user(creds.credentials)
    except AuthApiError:
        raise AppError("unauthorized", "Invalid or expired token.")
    except Exception:
        raise AppError("upstream_error", "Could not verify the session. Try again.")

    if res is None or res.user is None:
        raise AppError("unauthorized", "Invalid or expired token.")

    return UUID(res.user.id)
