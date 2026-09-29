# Instructions for Codex sessions

- Before making changes, read `CODEX_HANDOFF.md`. If it conflicts with current source, treat the source as authoritative.
- Verify an old audit finding still exists before acting on it. Preserve the handoff's invariants unless the task explicitly requires a change.
- Prefer small, targeted changes over broad refactors. Add or update focused regression tests for behavioral fixes.
- After relevant changes, run targeted tests, `npm run build`, and `git diff --check`.
- Do not commit or push unless explicitly requested.
- If work materially changes architecture, synchronization, persistence, financial/date semantics, security behavior, or known limitations, update `CODEX_HANDOFF.md` before finishing. Keep it concise and current; do not turn it into a changelog.
