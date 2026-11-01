from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

PaperStatus = Literal["processing", "ready", "failed"]


class Insights(BaseModel):
    tldr: str = Field(description="2 sentences, plain language")
    problem: str
    method: str
    datasets: list[str]
    metrics: list[str]
    key_results: list[str] = Field(description="max 5, with numbers if given")
    limitations: list[str] = Field(description="stated or clearly implied; max 5")
    contributions: list[str] = Field(description="max 4")
    field: str = Field(description="e.g. NLP, Computer Vision, Number Theory")


class PaperSummary(BaseModel):
    id: UUID
    title: str
    authors: list[str]
    source: Literal["arxiv", "upload"]
    arxiv_id: str | None
    status: PaperStatus
    status_step: str | None = None
    added_at: datetime
    published: date | None = None


class PaperDetail(PaperSummary):
    abstract: str | None
    categories: list[str]
    pdf_url: str | None
    parse_source: Literal["pdf", "html"] | None
    error: str | None
    insights: Insights | None
    chunk_count: int | None = None


class AddArxivRequest(BaseModel):
    arxiv_id: str  # ID or arXiv URL; normalized server-side


class AddPaperResponse(BaseModel):
    paper_id: UUID
    status: PaperStatus


class ArxivResult(BaseModel):
    arxiv_id: str
    title: str
    authors: list[str]
    abstract: str
    published: date
    categories: list[str]
    in_library: bool


class Source(BaseModel):
    n: int
    chunk_id: UUID
    paper_id: UUID
    paper_title: str
    section: str | None
    page: int | None
    snippet: str  # first ~200 chars, prefix stripped
    similarity: float


class Message(BaseModel):
    id: UUID
    role: Literal["user", "assistant"]
    content: str
    sources: list[Source] | None = None
    created_at: datetime


class CreateSessionRequest(BaseModel):
    paper_ids: list[UUID] = Field(min_length=1, max_length=5)
    title: str | None = None


class Session(BaseModel):
    id: UUID
    title: str | None
    paper_ids: list[UUID]
    created_at: datetime
    updated_at: datetime


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class SendMessageResponse(BaseModel):
    user_message: Message
    assistant_message: Message


class CompareRequest(BaseModel):
    paper_ids: list[UUID] = Field(min_length=2, max_length=3)


class ComparePaper(BaseModel):
    paper_id: UUID
    title: str
    insights: Insights


class CompareResponse(BaseModel):
    fields: list[str]
    papers: list[ComparePaper]


class GraphNode(BaseModel):
    id: str  # "s2:<paperId>" ; center uses "center"
    label: str
    year: int | None
    citation_count: int | None
    kind: Literal["center", "reference", "citation"]
    arxiv_id: str | None
    url: str | None


class GraphEdge(BaseModel):
    source: str  # cited
    target: str  # citing


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class ErrorBody(BaseModel):
    code: Literal[
        "invalid_input",
        "unauthorized",
        "not_found",
        "not_ready",
        "file_too_large",
        "rate_limited",
        "upstream_error",
    ]
    message: str
    reset_at: datetime | None = None  # only for daily-limit 429s


class MergeGuestRequest(BaseModel):
    guest_token: str = Field(min_length=20, max_length=4000)


class MergeGuestResponse(BaseModel):
    papers_copied: int
    uploads_moved: int
    chats_moved: int


class Usage(BaseModel):
    papers_used_today: int
    papers_limit: int
    messages_used_today: int
    messages_limit: int
    reset_at: datetime  # next 00:00 UTC
