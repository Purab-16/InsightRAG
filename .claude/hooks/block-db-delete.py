"""PreToolUse hook: block delete operations against a database."""
import json
import re
import sys

data = json.load(sys.stdin)
text = json.dumps(data.get("tool_input") or {})

patterns = [
    r"\bdelete\s+from\b",
    r"\bdrop\s+(table|database|schema|index|view|column|collection)\b",
    r"\btruncate\b",
    r"\bdeleteMany\b",
    r"\bdeleteOne\b",
    r"\bdb\.\w+\.drop\b",
    r"\b(drop|flush)db\b",
    r"\bflushall\b",
    r"\bprisma\s+migrate\s+reset\b",
    r"\bprisma\s+db\s+push\s+--force-reset\b",
]

for p in patterns:
    if re.search(p, text, re.IGNORECASE):
        print(
            "Blocked: database delete operations are not allowed for agents. "
            "Ask the user to do this step.",
            file=sys.stderr,
        )
        sys.exit(2)

sys.exit(0)
