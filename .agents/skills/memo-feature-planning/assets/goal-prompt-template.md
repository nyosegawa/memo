/goal

Start in the repository root and continue on branch `<branch-name>`. This is the implementation run for `<feature title>`.

Read these source artifacts first:
- `<feature-dir>/spec.md`
- `<feature-dir>/research.md`
- `<feature-dir>/plan.md`
- `<feature-dir>/todo.md`
- `AGENTS.md`

Repo guidance: keep Memo lightweight. Vanilla TypeScript owns editor state, rendering, shortcuts, tabs, theme, search, and pointer DnD. Rust/Tauri owns persistence, file metadata, app data paths, and thin IPC. Memo bodies stay plain markdown; metadata stays in `state.json`.

Execution mode: use the tier in `<feature-dir>/todo.md`. Tier S may complete as one unit. Tier M/L must proceed phase-first.

Implementation rules: follow `todo.md` phases and keep changes scoped to `plan.md`. Preserve repository-relative evidence. If scope expands or branch state is unsafe, stop and report.

Validation rules: run validation from `plan.md` and `AGENTS.md`, scaled to the changed surface. For user-facing app changes, include `npm run tauri build`; unless told not to, install `src-tauri/target/release/bundle/macos/Memo.app` to `/Applications/Memo.app` and verify launch.

Phase-level subagent review: after each phase implementation and validation, before marking the phase complete, request an independent subagent review with phase goal, artifact paths, changed files, validation commands/results, and diff summary. The reviewer must focus on defects, missed requirements, repo-rule violations, insufficient tests, unsafe assumptions, and user-facing regressions. Fix actionable findings, rerun relevant validation, then record the review result. If subagent tooling is unavailable, stop as blocked.

Browser QA rules: perform Browser/app QA when `plan.md` requires it or user-facing behavior changed. Record concrete coverage and rough edges.

Commit/push/PR/CI rules: commit when implementation evidence is complete. Push and create/follow PR/CI when required by `plan.md` or repo guidance.

Evidence rules: update only `<feature-dir>/todo.md` `Evidence Summary` with concise Implementation, Validation, Review, Browser QA, Commit/Push, PR/CI, and Notes entries.

Stop conditions: stop when complete with evidence, blocked, unsafe branch state, missing subagent review, validation failure you cannot fix, or scope expansion requiring user input.

Escalation conditions: ask before destructive operations, dependency/framework additions, persistence migrations, file association changes, or changes outside the approved plan.

Keep this prompt under 4000 characters when instantiated.
