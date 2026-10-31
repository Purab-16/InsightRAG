"""PDF to ParsedPaper. Runs only inside the sandboxed worker (see sandbox.py).

Do not import anything from `app` here: the worker process must not load settings or secrets.
"""

import re
from collections import Counter

import pymupdf

from parsers.types import Block, ParsedPaper

MAX_TEXT_CHARS = 2_000_000
MIN_TEXT_CHARS = 500
MAX_HEADING_CHARS = 80

# Normalized section names; keys are lower-case heading text.
_KNOWN = {
    "abstract": "Abstract",
    "introduction": "Introduction",
    "related work": "Related Work",
    "related works": "Related Work",
    "background": "Related Work",
    "prior work": "Related Work",
    "literature review": "Related Work",
    "method": "Method",
    "methods": "Method",
    "methodology": "Method",
    "approach": "Method",
    "our approach": "Method",
    "proposed method": "Method",
    "experiment": "Experiments",
    "experiments": "Experiments",
    "experimental setup": "Experiments",
    "evaluation": "Experiments",
    "result": "Results",
    "results": "Results",
    "experimental results": "Results",
    "results and discussion": "Results",
    "discussion": "Discussion",
    "conclusion": "Conclusion",
    "conclusions": "Conclusion",
    "conclusion and future work": "Conclusion",
    "references": "References",
    "bibliography": "References",
    "appendix": "Appendix",
    "appendices": "Appendix",
}

_NUMBERED = re.compile(r"^(\d+(?:\.\d+)*)\.?\s+(\S.*)$")
_LETTERED = re.compile(r"^([A-Z](?:\.\d+)*)\.?\s+(\S.*)$")
_BAD_TITLES = ("untitled", ".pdf", ".dvi", ".tex", ".doc", "microsoft word")


class PdfParseError(Exception):
    """code is one of: too_many_pages, no_text, unreadable."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


class _Line:
    __slots__ = ("text", "size", "bold", "y0", "y1")

    def __init__(self, text, size, bold, y0, y1):
        self.text, self.size, self.bold, self.y0, self.y1 = text, size, bold, y0, y1


def _page_lines(page) -> list[list[_Line]]:
    """Lines of one page, grouped per text block (a block is roughly a paragraph)."""
    blocks = []
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        lines = []
        for line in block["lines"]:
            if abs(line["dir"][0]) < 0.9:  # rotated text, e.g. the arXiv side stamp
                continue
            spans = [s for s in line["spans"] if s["text"].strip()]
            if not spans:
                continue
            text = "".join(s["text"] for s in line["spans"]).strip()
            size = max(s["size"] for s in spans)
            bold = all(bool(s["flags"] & 16) or "bold" in s["font"].lower() for s in spans)
            lines.append(_Line(text, size, bold, line["bbox"][1], line["bbox"][3]))
        if lines:
            blocks.append(lines)
    return blocks


def _norm_key(text: str) -> str:
    return re.sub(r"\d+", "#", text.strip().lower())


def _repeated_margin_lines(pages: list[list[list[_Line]]], heights: list[float]) -> set[str]:
    """Header/footer text: lines in the top or bottom 10% of the page that repeat on > 50% of pages."""
    n = len(pages)
    if n < 3:
        return set()
    counts: Counter = Counter()
    for page_blocks, h in zip(pages, heights):
        seen = set()
        for block in page_blocks:
            for ln in block:
                if ln.y1 < 0.10 * h or ln.y0 > 0.90 * h:
                    seen.add(_norm_key(ln.text))
        counts.update(seen)
    return {k for k, c in counts.items() if c > n * 0.5}


def _is_margin(ln: _Line, h: float) -> bool:
    return ln.y1 < 0.10 * h or ln.y0 > 0.90 * h


_SMALL_WORDS = {"a", "an", "and", "as", "at", "for", "in", "of", "on", "or", "the", "to", "vs"}


def _title_case(text: str) -> str:
    words = re.sub(r"[\x80-\x9f�]", "'", text).split()
    out = []
    for i, w in enumerate(words):
        lw = w.lower()
        out.append(lw if i and lw in _SMALL_WORDS else w[:1].upper() + w[1:].lower())
    return " ".join(out)


def _clean_label(title: str) -> str:
    title = re.sub(r"[\x80-\x9f�]", "'", title).strip()
    return _title_case(title) if title.isupper() else title


def _parse_heading(text: str, is_style: bool, allow_letters: bool, top: str | None):
    """Return (depth, label, lettered) if the line is a section heading, else None.

    lettered is True for appendix-style headings such as "A Proofs".
    """
    if len(text) > MAX_HEADING_CHARS:
        return None

    key = text.lower().strip(" .:")
    if key in _KNOWN and (is_style or text.isupper()):
        return 1, _KNOWN[key], False

    if not is_style:
        return None

    lettered = False
    m = _NUMBERED.match(text)
    if m is None and allow_letters:
        m = _LETTERED.match(text)
        lettered = m is not None
    if m is None:
        return None

    number, title = m.group(1), _clean_label(m.group(2))
    if not title[0].isalpha() or not any(c.isalpha() for c in title):
        return None
    depth = number.count(".") + 1
    label = _KNOWN.get(title.lower().strip(" .:"), title)
    if lettered and depth == 1:
        label = f"Appendix > {title}"
    elif depth > 1 and top:
        label = f"{top} > {title}"
    return depth, label, lettered


def _is_noise(text: str) -> bool:
    """Figure axis labels, tick numbers and tiny fragments are not useful for retrieval."""
    compact = re.sub(r"\s+", "", text)
    if len(compact) < 20:
        return True
    letters = sum(c.isalpha() for c in compact)
    return letters / len(compact) < 0.5


def _join(prev: str, nxt: str) -> str:
    if prev.endswith("-") and len(prev) > 1 and prev[-2].isalpha() and nxt[:1].islower():
        return prev[:-1] + nxt
    return f"{prev} {nxt}"


def _body_size(pages: list[list[list[_Line]]]) -> float:
    sizes: Counter = Counter()
    for page_blocks in pages:
        for block in page_blocks:
            for ln in block:
                sizes[round(ln.size, 1)] += len(ln.text)
    return sizes.most_common(1)[0][0] if sizes else 10.0


def _title(doc, pages) -> str | None:
    meta = (doc.metadata or {}).get("title") or ""
    meta = meta.strip()
    if len(meta) > 5 and not any(b in meta.lower() for b in _BAD_TITLES):
        return _clean_title(meta)
    if not pages or not pages[0]:
        return None
    lines = [ln for block in pages[0] for ln in block]
    biggest = max(ln.size for ln in lines)
    parts = [ln.text for ln in lines if ln.size >= biggest - 0.3]
    return _clean_title(" ".join(parts)) or None


def _clean_title(title: str) -> str:
    title = re.sub(r"(\w)- (\w)", r"\1\2", title)  # line-break hyphenation: "LAN- GUAGE"
    title = title.strip()[:300]
    return _title_case(title) if title.isupper() else title


def parse_pdf_bytes(pdf_bytes: bytes, max_pages: int) -> ParsedPaper:
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        raise PdfParseError("unreadable")

    try:
        if doc.needs_pass or doc.is_encrypted:
            raise PdfParseError("unreadable")
        if doc.page_count > max_pages:
            raise PdfParseError("too_many_pages")
        if doc.page_count == 0:
            raise PdfParseError("unreadable")

        pages, heights = [], []
        try:
            for page in doc:
                pages.append(_page_lines(page))
                heights.append(page.rect.height)
        except Exception:
            raise PdfParseError("unreadable")

        title = _title(doc, pages)
    finally:
        doc.close()

    body = _body_size(pages)
    repeated = _repeated_margin_lines(pages, heights)

    blocks: list[Block] = []
    section: str | None = None
    top: str | None = None
    in_refs = False
    total = 0

    for page_no, (page_blocks, h) in enumerate(zip(pages, heights), start=1):
        for lines in page_blocks:
            para, para_page = "", page_no

            def flush():
                nonlocal para, total
                if para and not in_refs and not _is_noise(para):
                    blocks.append(Block(para.strip(), section, para_page))
                    total += len(para)
                para = ""

            pending_number = None  # LaTeX often puts the section number on its own line
            for ln in lines:
                if _is_margin(ln, h) and (
                    _norm_key(ln.text) in repeated or re.fullmatch(r"\d{1,4}", ln.text)
                ):
                    continue
                if re.match(r"(?i)^arxiv:\d", ln.text):
                    continue

                is_style = ln.size >= body + 0.7 or ln.bold

                if is_style and re.fullmatch(r"(\d+(\.\d+)*|[A-Z](\.\d+)*)\.?", ln.text):
                    flush()
                    pending_number = ln.text
                    continue
                text = f"{pending_number} {ln.text}" if pending_number and is_style else ln.text
                pending_number = None

                heading = _parse_heading(
                    text, is_style, allow_letters=in_refs or top == "Appendix", top=top
                )
                if heading:
                    flush()
                    depth, label, lettered = heading
                    if label == "References":
                        in_refs, section, top = True, None, "References"
                    elif in_refs:
                        # only an appendix heading ends the reference list
                        if label == "Appendix" or lettered:
                            in_refs, top, section = False, "Appendix", label
                    else:
                        if depth == 1 and not lettered:
                            top = label
                        section = label
                    continue

                if in_refs:
                    continue
                if not para:
                    para_page = page_no
                    para = ln.text
                else:
                    para = _join(para, ln.text)
            flush()

            if total > MAX_TEXT_CHARS:
                break
        if total > MAX_TEXT_CHARS:
            break

    # Drop front matter (title, authors, affiliations) when a real section start exists.
    if any(b.section in ("Abstract", "Introduction") for b in blocks):
        while blocks and blocks[0].section is None:
            blocks.pop(0)

    if sum(len(b.text) for b in blocks) < MIN_TEXT_CHARS:
        raise PdfParseError("no_text")

    return ParsedPaper(title=title, blocks=blocks, source="pdf")
