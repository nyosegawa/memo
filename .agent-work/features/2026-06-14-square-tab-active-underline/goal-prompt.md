/goal

Start in the repository root and continue on branch `codex/square-tab-active-underline`. This is the implementation run for `Square Tab Active Underline`.

Read these source artifacts first:
- `.agent-work/features/2026-06-14-square-tab-active-underline/spec.md`
- `.agent-work/features/2026-06-14-square-tab-active-underline/research.md`
- `.agent-work/features/2026-06-14-square-tab-active-underline/plan.md`
- `.agent-work/features/2026-06-14-square-tab-active-underline/todo.md`
- `AGENTS.md`

Repo guidance: keep Memo lightweight. Vanilla TypeScript owns editor state, rendering, shortcuts, tabs, theme, search, and pointer DnD. Rust/Tauri owns persistence, file metadata, app data paths, and thin IPC. Memo bodies stay plain markdown; metadata stays in `state.json`.

Execution mode: Tier S from `todo.md`. Complete the single CSS phase as one scoped unit.

Implementation rules: follow `todo.md` and keep changes scoped to `plan.md`. Expected source change is `src/styles.css`: make `.tab` square, remove the active top glow/highlight, and render `.tab.is-active` with a theme-aware bottom selection line. Preserve tab dimensions, close button hit target, horizontal scrolling, keyboard behavior, and pointer-based tab DnD. Do not change persistence, IPC, Rust backend, markdown storage, or tab state logic unless CSS-only implementation proves insufficient. If scope expands or branch state is unsafe, stop and report.

Validation rules: run `npm run lint`, `npm run typecheck`, `npm run test:run`, `(cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --lib)`, and `npm run tauri build`. For this user-facing app change, install the built macOS app and verify launch unless told not to.

Phase-level subagent review: after implementation and validation, before marking `P001` complete, request an independent subagent review with phase goal, changed files, validation results, and diff summary. The reviewer must focus on defects, missed requirements, repo-rule violations, insufficient QA, unsafe assumptions, and user-facing regressions. Fix actionable findings, rerun relevant validation, then record the review result. If subagent tooling is unavailable, stop as blocked.

Browser QA rules: verify active/inactive square tabs, no active top glow, visible bottom active line, light/dark themes, multiple-tab scrolling, tab activation, close button, keyboard tab navigation, and pointer tab reordering. Record concrete coverage and rough edges.

Commit/push/PR/CI rules: commit when implementation evidence is complete. Push and create/follow PR/CI per repo guidance unless a later instruction says not to.

Evidence rules: update only `.agent-work/features/2026-06-14-square-tab-active-underline/todo.md` `Evidence Summary` with concise Implementation, Validation, Review, Browser QA, Commit/Push, PR/CI, and Notes entries.

Stop conditions: stop when complete with evidence, blocked, unsafe branch state, missing subagent review, validation failure you cannot fix, or scope expansion requiring user input.

Escalation conditions: ask before destructive operations, dependency/framework additions, persistence migrations, file association changes, or changes outside the approved plan.
