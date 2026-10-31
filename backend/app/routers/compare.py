from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth import get_user_id
from app.db import get_db
from app.errors import AppError
from app.models import CompareRequest, ComparePaper, CompareResponse, Insights

router = APIRouter(prefix="/compare", tags=["compare"])

FIELDS = [
    "tldr",
    "problem",
    "method",
    "datasets",
    "metrics",
    "key_results",
    "limitations",
    "contributions",
    "field",
]


@router.post("", response_model=CompareResponse)
def compare_papers(body: CompareRequest, user_id: UUID = Depends(get_user_id)):
    """Side-by-side table from stored insights. No LLM call."""
    ids = [str(p) for p in dict.fromkeys(body.paper_ids)]
    if len(ids) < 2:
        raise AppError("invalid_input", "Pick at least 2 different papers.")

    db = get_db()
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

    rows = db.table("papers").select("id,title,insights").in_("id", ids).execute().data
    by_id = {r["id"]: r for r in rows}

    missing = [by_id[i]["title"] for i in ids if not by_id[i]["insights"]]
    if missing:
        raise AppError("not_ready", f"Insights are not available for: {', '.join(missing)}.")

    return CompareResponse(
        fields=FIELDS,
        papers=[
            ComparePaper(
                paper_id=i,
                title=by_id[i]["title"],
                insights=Insights.model_validate(by_id[i]["insights"]),
            )
            for i in ids
        ],
    )
