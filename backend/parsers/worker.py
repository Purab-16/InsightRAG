"""Sandboxed PDF worker. Reads PDF bytes from stdin, writes JSON to stdout.

Usage: python -m parsers.worker <max_pages> <memory_mb> <cpu_seconds>

Expected failures exit 0 with {"ok": false, "error": <code>}. Crashes, timeouts and
memory-limit kills exit non-zero and the caller treats them as unreadable.
Never import `app` here: this process must not see settings or secrets.
"""

import json
import sys


def _apply_limits(memory_mb: int, cpu_seconds: int) -> None:
    try:
        import resource  # POSIX only
    except ImportError:
        return
    mem = memory_mb * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_AS, (mem, mem))
    resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))


def main() -> None:
    max_pages = int(sys.argv[1])
    _apply_limits(int(sys.argv[2]), int(sys.argv[3]))

    from parsers.pdf_parser import PdfParseError, parse_pdf_bytes

    data = sys.stdin.buffer.read()
    try:
        parsed = parse_pdf_bytes(data, max_pages)
    except PdfParseError as e:
        out = {"ok": False, "error": e.code}
    else:
        out = {
            "ok": True,
            "title": parsed.title,
            "blocks": [
                {"text": b.text, "section": b.section, "page": b.page} for b in parsed.blocks
            ],
        }
    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    main()
