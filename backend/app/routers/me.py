from uuid import UUID

from fastapi import APIRouter, Depends

from app import quota
from app.auth import get_user_id
from app.models import Usage

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/usage", response_model=Usage)
def get_usage(user_id: UUID = Depends(get_user_id)):
    return quota.usage(user_id)
