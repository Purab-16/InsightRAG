# Agent Guardrails

These rules apply to every AI tool in this project (Claude, Codex, Cursor, Copilot, OpenCode, Antigravity, and any other).

## 1. No git or GitHub commands

- Never run any `git` or `gh` command. This includes status, diff, log, add, commit, push, pull, checkout, branch, merge, rebase, stash, and reset.
- Only the user runs git commands.
- If git output is needed, ask the user to run the command and paste the result.

## 2. Plan first, approval before changes

- Do not create, edit, move, or delete any file without the user's approval.
- Always show a short plan first: what will change and why.
- Wait for a clear "yes" or approval. Then proceed.
- If the scope grows, stop and show an updated plan.

## 3. No delete operations on the database

- Never run `DELETE`, `DROP`, `TRUNCATE`, or any equivalent against any database.
- This includes SQL, ORM calls, migrations, admin tools, and MCP database tools.
- If removal seems needed, explain it and let the user do it.

## 4. No critical operations or decisions

- Do not take critical actions on your own. Examples: deployments, production changes, credential or secret changes, schema changes, dependency upgrades, mass file changes, destructive commands.
- Do not make architecture or irreversible decisions alone.
- Present options with a recommendation and ask the user to decide.

## Enforcement

- Claude Code: enforced by `.claude/settings.json` and hooks in `.claude/hooks/`.
- Other tools: no hooks available, so these rules are instructions. Follow them strictly.
