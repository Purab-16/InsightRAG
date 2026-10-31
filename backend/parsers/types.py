from dataclasses import dataclass


@dataclass
class Block:
    text: str
    section: str | None
    page: int | None  # 1-based for PDF, None for HTML


@dataclass
class ParsedPaper:
    title: str | None
    blocks: list[Block]
    source: str  # "pdf" | "html"
