import logging

from app.db import get_db
from app.errors import AppError
from ingestion.arxiv_client import download_pdf
from insights.extractor import extract_insights, sections_from_blocks
from parsers.sandbox import ParseError, parse_pdf_safely
from rag.chunker import chunk_paper
from rag.embedder import embed_documents

log = logging.getLogger("insightrag.pipeline")

INSERT_BATCH = 50
GENERIC_FAILURE = "Something went wrong while processing this paper. Try again."


def _set(paper_id: str, **fields) -> None:
    get_db().table("papers").update(fields).eq("id", paper_id).execute()


def _load_pdf(paper: dict) -> bytes:
    if paper["source"] == "arxiv":
        return download_pdf(paper["arxiv_id"])
    path = f"{paper['uploaded_by']}/{paper['id']}.pdf"
    return get_db().storage.from_("uploads").download(path)


def process_paper(paper_id: str) -> None:
    """parse -> chunk -> embed -> insert -> ready. Never raises; failures set status='failed'.

    Insights are best effort: if they fail the paper is still ready. Callers must clear old chunks before re-running a paper
    (the retry endpoint does this), otherwise chunks are duplicated.
    """
    db = get_db()
    try:
        paper = db.table("papers").select("*").eq("id", paper_id).single().execute().data

        _set(paper_id, status="processing", status_step="parsing", error=None)
        parsed = parse_pdf_safely(_load_pdf(paper))

        title = paper["title"]
        if paper["source"] == "upload" and parsed.title:
            title = parsed.title  # uploads only have a filename until the PDF is read
            _set(paper_id, title=title)

        chunks = chunk_paper(parsed, title)
        if not chunks:
            raise ParseError("We couldn't read this PDF. It may be scanned, damaged or protected.")

        _set(paper_id, status_step="embedding", parse_source="pdf")
        vectors = embed_documents([c.content for c in chunks])

        rows = [
            {
                "paper_id": paper_id,
                "chunk_index": c.chunk_index,
                "content": c.content,
                "section": c.section,
                "page": c.page,
                "embedding": v,
            }
            for c, v in zip(chunks, vectors)
        ]
        for i in range(0, len(rows), INSERT_BATCH):
            db.table("chunks").insert(rows[i : i + INSERT_BATCH]).execute()

        _set(paper_id, status_step="insights")
        insights = extract_insights(
            title, paper["abstract"], sections_from_blocks(parsed.blocks)
        )

        _set(
            paper_id,
            status="ready",
            status_step=None,
            insights=insights.model_dump() if insights else None,
        )
    except (ParseError, AppError) as e:
        message = e.message if isinstance(e, AppError) else str(e)
        _set(paper_id, status="failed", status_step=None, error=message)
    except Exception:
        log.exception("processing failed for paper %s", paper_id)
        _set(paper_id, status="failed", status_step=None, error=GENERIC_FAILURE)
