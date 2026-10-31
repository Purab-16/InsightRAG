from bisect import bisect_right
from dataclasses import dataclass
from itertools import groupby

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import get_settings
from parsers.types import ParsedPaper

MIN_CHUNK_CHARS = 50


@dataclass
class Chunk:
    chunk_index: int
    content: str  # "[title | section]\n" prefix + text
    section: str | None
    page: int | None  # page of the chunk's first block


def chunk_paper(
    parsed: ParsedPaper,
    title: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[Chunk]:
    """Split a parsed paper into chunks. A chunk never spans two sections."""
    s = get_settings()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size or s.chunk_size,
        chunk_overlap=chunk_overlap if chunk_overlap is not None else s.chunk_overlap,
        add_start_index=True,
    )

    chunks: list[Chunk] = []
    # Consecutive blocks with the same section form one group; splitting never crosses groups.
    for section, group in groupby(parsed.blocks, key=lambda b: b.section):
        blocks = list(group)

        text, starts = "", []
        for b in blocks:
            starts.append(len(text))
            text += b.text + "\n\n"

        prefix = f"[{title} | {section}]\n" if section else f"[{title}]\n"

        for doc in splitter.create_documents([text]):
            body = doc.page_content.strip()
            if len(body) < MIN_CHUNK_CHARS:
                continue
            idx = bisect_right(starts, doc.metadata["start_index"]) - 1
            chunks.append(
                Chunk(
                    chunk_index=len(chunks),
                    content=prefix + body,
                    section=section,
                    page=blocks[max(idx, 0)].page,
                )
            )
    return chunks
