"""PreToolUse hook: block git and gh commands. Only the user runs them."""
import json
import re
import sys

data = json.load(sys.stdin)
command = (data.get("tool_input") or {}).get("command", "")

# Match git/gh at the start of the command or after a separator, with optional path or .exe.
pattern = re.compile(r"(^|[;&|(`\s])(?:[\w./\\:-]*[/\\])?(git|gh)(\.exe)?(\s|$)", re.IGNORECASE)

if pattern.search(command):
    print(
        "Blocked: git/gh commands are not allowed for agents. "
        "Ask the user to run the command and share the output.",
        file=sys.stderr,
    )
    sys.exit(2)

sys.exit(0)
