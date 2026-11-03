import json
import logging
import os
import subprocess
import sys
from pathlib import Path

from app.config import get_settings
from parsers.types import Block, ParsedPaper

log = logging.getLogger("insightrag.sandbox")

BACKEND_DIR =Path(__file__).resolve().parent.parent

# The worker gets only these variables, so API keys in the environment never reach it.
_ENV_KEEP = ("PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "LANG", "LC_ALL")

_UNREADABLE = "We couldn't read this PDF. It may be scanned, damaged or protected."


class ParseError(Exception):
    """Message is safe to show to the user and to store in papers.error."""


def parse_pdf_safely(pdf_bytes: bytes) -> ParsedPaper:
    """Parse a PDF in a separate process with a timeout, page limit and (on Linux) memory/CPU caps.

    On Windows the memory and CPU caps are skipped (no `resource` module); the timeout and
    page limit still apply. Production runs on Linux (Render).
    """
    s = get_settings()
    env = {k: v for k, v in os.environ.items() if k in _ENV_KEEP}
    env["PYTHONIOENCODING"] = "utf-8"

    try:
        proc = subprocess.run(
            [
                sys.executable,
                "-m",
                "parsers.worker",
                str(s.max_pdf_pages),
                str(s.parse_memory_mb),
                str(s.parse_timeout_s),
            ],
            input=pdf_bytes,
            capture_output=True,
            timeout=s.parse_timeout_s,
            cwd=BACKEND_DIR,
            env=env,
        )
    except subprocess.TimeoutExpired:
        raise ParseError("This PDF took too long to read. Try a shorter or simpler file.")

    if proc.returncode != 0:
        log.error(
            "pdf worker exited with code %s: %s",
            proc.returncode,
            proc.stderr[-2000:].decode("utf-8", errors="replace"),
        )
        raise ParseError(_UNREADABLE)

    try:
        out = json.loads(proc.stdout)
    except ValueError:
        raise ParseError(_UNREADABLE)

    if not out.get("ok"):
        if out.get("error") == "too_many_pages":
            raise ParseError(
                f"This PDF has more than {s.max_pdf_pages} pages. "
                "Try the arXiv version or a shorter file."
            )
        raise ParseError(_UNREADABLE)

    return ParsedPaper(
        title=out["title"],
        blocks=[Block(b["text"], b["section"], b["page"]) for b in out["blocks"]],
        source="pdf",
    )
