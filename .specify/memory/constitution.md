# Memo Constitution

## Core Principles

### I. Lightweight By Default
Memo is an ultra-lightweight macOS memo app. New work must preserve the vanilla TypeScript frontend and thin Rust/Tauri backend unless a dependency removes substantial, measurable complexity. Do not add a frontend framework, markdown renderer, rich-text model, manual save flow, or file association support unless the feature request explicitly requires it.

### II. Plain Markdown Persistence
Memo bodies are plain markdown files under the app data directory. Rust owns persistence, file metadata, and filesystem boundaries. TypeScript owns editor state, keyboard shortcuts, UI rendering, and pointer-based drag and drop. Order, open tabs, active tab, and theme remain metadata rather than memo body content.

### III. Predictable Memo Semantics
Sidebar titles must come from the first non-empty markdown line, with empty memos shown as `Untitled memo`. Changes must preserve existing memo ordering, tab behavior, keyboard navigation, theme persistence, and pointer-based reordering unless the spec explicitly calls for a change.

### IV. Test And Build Gates
Every implementation plan must include the repository validation gates relevant to the changed surface. Before declaring a user-facing or repository change complete, run:

```bash
npm run lint
npm run typecheck
npm run test:run
(cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --lib)
npm run tauri build
```

If a gate cannot run in the current environment, record the exact command, failure reason, and residual risk in the handoff.

### V. User-Facing App Verification
For user-facing app changes, the release bundle must be treated as the real artifact. Unless explicitly told not to, replace `/Applications/Memo.app` with `src-tauri/target/release/bundle/macos/Memo.app` after a successful build and verify the installed app launches.

## Project Constraints

- Keep Tauri IPC thin and command-oriented.
- Prefer focused changes over broad refactors.
- Preserve pointer-event drag and drop; native drag events can conflict with desktop webview behavior.
- Keep generated specs, plans, and tasks aligned with the actual Tauri 2, vanilla TypeScript, Rust, Vite, Vitest, Biome, and Cargo setup in this repository.
- License-file names must use `{year} Sakasegawa`; confirm the current year with `date +%Y` before editing license text.

## Spec-Driven Workflow

Spec Kit is installed in Codex skills mode. Use the skills in this order unless the task clearly calls for a narrower path:

1. `$speckit-constitution` to amend these principles.
2. `$speckit-specify` to capture what and why.
3. `$speckit-clarify` when requirements are ambiguous.
4. `$speckit-plan` to define technical approach and validation.
5. `$speckit-tasks` to create ordered implementation tasks.
6. `$speckit-analyze` when artifact consistency needs review.
7. `$speckit-implement` only after the spec, plan, and tasks are ready.

Implementation work must stay grounded in the generated artifacts and the repository's current code. If a generated artifact conflicts with this constitution or `AGENTS.md`, stop and update the spec artifacts before implementing.

## Governance

This constitution guides Spec Kit artifacts for Memo and complements `AGENTS.md`. `AGENTS.md` remains the operational source for agent commands and repository rules; this constitution is the spec-driven planning source. Amendments must be explicit, preserve rationale in the change, and update affected specs or plans when existing feature artifacts depend on older rules.

**Version**: 1.0.0 | **Ratified**: 2026-06-14 | **Last Amended**: 2026-06-14
