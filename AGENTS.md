# Instructions for Codex sessions

- Before making changes, read `CODEX_HANDOFF.md`; current source is authoritative if the handoff is stale. Verify old audit findings against current code, and preserve established invariants unless the task requires a change.
- Prefer small, targeted changes over broad refactors. Add or update focused regression tests for behavioral fixes.
- After relevant changes, run targeted tests, `npm run build`, and `git diff --check`.
- Do not commit or push unless explicitly requested.
- Before finishing, check whether the handoff disagrees with the code. After any task that changes documented behavior, architecture, data format, sync or financial semantics, important invariants, deployment/PWA behavior, accepted limitations, known issues, or meaningful verification/test status, update `CODEX_HANDOFF.md`. When fixing a documented bug or limitation, remove or revise its stale entry; record newly accepted limitations. Keep verification status current when regression/build results meaningfully change. Preserve only information useful for understanding the current state; do not make the handoff a chronological changelog. Pure cosmetic changes, comments, typo fixes, and changes with no relevance to future work do not require an update. State in the final response whether the handoff was updated and, if not, why no update was required.
