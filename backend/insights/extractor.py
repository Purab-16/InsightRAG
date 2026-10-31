import logging
from itertools import groupby

from pydantic import ValidationError

from app.errors import AppError
from app.gemini import generate
from app.models import Insights
from parsers.types import Block
from rag.prompts import INSIGHTS_PROMPT
from rag.retriever import strip_prefix

log = logging.getLogger("insightrag.insights")

TOTAL_CHARS = 28_000  # budget for the paper text sent to the model
GROUP_CHARS = 6_500  # per priority group, so one long section cannot crowd out the others
OTHER_SECTION_CHARS = 3_000

# Priority groups, matched by keyword because many papers use custom section names
# ("Our Method", "Empirical Experiments"). Appendix sections never count as priority.
_GROUPS = (
    ("introduction",),
    ("method", "approach", "model", "architecture", "algorithm"),
    ("experiment", "result", "evaluation"),
    ("conclusion", "discussion", "limitation"),
)
_SKIP = ("abstract", "references", "appendix")

Sections = list[tuple[str | None, str]]  # (section label, text), in document order


def sections_from_blocks(blocks: list[Block]) -> Sections:
    return [
        (section, "\n\n".join(b.text for b in group))
        for section, group in groupby(blocks, key=lambda b: b.section)
    ]


def sections_from_chunks(chunk_rows: list[dict]) -> Sections:
    """For papers that are already stored: rebuild section text from their chunks (ordered by chunk_index)."""
    return [
        (section, "\n\n".join(strip_prefix(r["content"]) for r in group))
        for section, group in groupby(chunk_rows, key=lambda r: r["section"])
    ]


def _matches(label: str | None, keywords: tuple[str, ...]) -> bool:
    low = (label or "").lower()
    return not low.startswith(_SKIP) and any(k in low for k in keywords)


def build_section_text(sections: Sections) -> str:
    used: set[int] = set()
    parts: list[str] = []
    total = 0

    def add(label: str | None, text: str, cap: int) -> None:
        nonlocal total
        text = text[: min(cap, TOTAL_CHARS - total)]
        if text:
            parts.append(f"## {label or 'Text'}\n{text}")
            total += len(text)

    for keywords in _GROUPS:
        idx = [i for i, (label, _) in enumerate(sections) if _matches(label, keywords) and i not in used]
        if not idx:
            continue
        used.update(idx)
        text = "\n\n".join(sections[i][1] for i in idx)
        add(sections[idx[0]][0], text, GROUP_CHARS)

    for i, (label, text) in enumerate(sections):
        if i not in used and not (label or "").lower().startswith(_SKIP):
            add(label, text, OTHER_SECTION_CHARS)

    return "\n\n".join(parts)


def _abstract(abstract: str | None, sections: Sections) -> str:
    if abstract:
        return abstract
    for label, text in sections:
        if (label or "").lower() == "abstract":
            return text[:3000]
    return "Not available"


def extract_insights(title: str, abstract: str | None, sections: Sections) -> Insights | None:
    """Structured insights for one paper, or None if they cannot be produced.

    A failure never fails the paper: chat still works without insights.
    """
    prompt = INSIGHTS_PROMPT.format(
        title=title,
        abstract=_abstract(abstract, sections),
        section_text=build_section_text(sections),
    )
    for attempt in (1, 2):  # one retry if the model returns invalid JSON
        try:
            text = generate(
                prompt, response_mime_type="application/json", response_schema=Insights
            )
            return Insights.model_validate_json(text)
        except ValidationError:
            log.warning("insights JSON invalid (attempt %d)", attempt)
        except AppError as e:
            log.warning("insights skipped: %s", e.code)
            return None
    return None
