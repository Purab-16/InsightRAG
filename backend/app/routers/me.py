from uuid import UUID

from fastapi import APIRouter, Depends

from app import quota
from app.auth import get_user, get_user_id, verify_token
from app.errors import AppError
from app.merge import merge_guest_into_account
from app.models import MergeGuestRequest, MergeGuestResponse, Usage

# Plain `def` routes on purpose: the Supabase client blocks, so FastAPI runs them in a thread.
router = APIRouter(prefix="/me", tags=["me"])


@router.get("/usage", response_model=Usage)
def get_usage(user_id: UUID = Depends(get_user_id)):
    return quota.usage(user_id)


@router.post("/merge-guest", response_model=MergeGuestResponse)
def merge_guest(body: MergeGuestRequest, account=Depends(get_user)):
    """Copy the guest's papers and chats into the signed-in account. Needs both tokens, so only someone who holds
    the guest session and the account can do it."""
    if account.is_anonymous:
        raise AppError("invalid_input", "Sign in to an account first.")

    guest = verify_token(body.guest_token)
    if not guest.is_anonymous:
        raise AppError("invalid_input", "That session is not a guest session.")
    if guest.id == account.id:
        raise AppError("invalid_input", "That is already this account.")

    return merge_guest_into_account(UUID(guest.id), UUID(account.id))
