---
name: memo-feature-planning
description: Create a repo-local Memo feature planning package before implementation. Use when the user asks for feature planning, plan before implementation, research/plan/todo/goal prompt, /goal に投げる前提で準備, 実装前に計画, or 機能計画 for this Tauri memo app. Do not use for direct implementation-only fixes.
---

# Memo Feature Planning

Use this skill to plan future features for the Memo repository, produce a validated planning package, commit/push that package, then stop. Implementation happens in a later `/goal` run using the generated `goal-prompt.md`.

## Required Reading

Before planning, read:

- `references/artifact-contract.md` for required artifact sections and validation rules.
- `references/freshness-policy.md` for when repo guidance must be refreshed.
- `references/repo-research-summary.md` unless `scripts/check-freshness.mjs` reports stale or missing inputs.
- Templates under `assets/` when creating artifacts.

Near misses:

- If the user asks to implement immediately, do the normal code workflow instead.
- If the user asks to update this skill itself, use the generic skill-creation workflow first.

## Workflow

1. Confirm the repository root is the Memo repo. Use repository-relative paths in all artifacts.
2. Run `node .agents/skills/memo-feature-planning/scripts/check-freshness.mjs`. Record the result in `research.md`.
3. If freshness is stale or missing, refresh the affected reference/template/script files before relying on their guidance.
4. Determine or create the planning/implementation branch using repo conventions. Planning and implementation share the same branch.
5. Create `.agent-work/features/<YYYY-MM-DD>-<slug>/`, where the date is local and the slug is lowercase hyphenated from the request.
6. Run the Specify Checkpoint before technical planning.
7. Write `spec.md` from `assets/spec-template.md`.
8. Run the Research Checkpoint before `plan.md`.
9. Use subagents for independent research lanes in parallel. Add more rounds when findings conflict or important decisions lack evidence.
10. Write `research.md`, `plan.md`, `todo.md`, and `goal-prompt.md` from the templates.
11. Keep `goal-prompt.md` implementation-run-only and at most 4000 characters. Put planning-run stop rules in this skill, not in the goal prompt.
12. Run `node .agents/skills/memo-feature-planning/scripts/validate-artifacts.mjs <feature-dir>`.
13. Fix validation failures and rerun validation until clean.
14. Commit the planning package and any needed skill-guidance refresh on the same branch.
15. Push the branch.
16. Report feature directory, branch, validation result, push status, and `goal-prompt.md` path.
17. Stop. Do not start implementation, do not run `/goal`, and do not begin `P001`.

## Specify Checkpoint

Planning starts with a short user conversation. Before creating artifacts, ask the next most useful clarification question. Ask one question at a time. Each question uses `A.`, `B.`, `C.`, `D.` choices, has exactly one recommended choice, and uses `D.` for custom input.

Continue until every planning-relevant ambiguity is resolved. A planning-relevant ambiguity is anything that could change user-visible behavior, implementation scope, validation expectations, completion criteria, data or persistence impact, compatibility expectations, security or privacy impact, rollout expectations, risk level, phase breakdown, or acceptance criteria.

When the user has already provided enough detail, ask a confirmation-shaped question that lets them choose the intended default or override it. For small or obvious requests, use the question to confirm the default interpretation instead of expanding scope. Small details outside behavior, scope, validation, risk, phases, and acceptance criteria can be captured as assumptions or minor open questions.

Update the working understanding after each answer. Record all answers, selected choices, custom input, assumptions, and the full clarification log in `spec.md`. Do not leave `[NEEDS CLARIFICATION: ...]` markers before planning.

## Research Checkpoint

Before writing `plan.md`, run subagent-based research. Research starts with a short user conversation to align on research depth.

Derive research questions from `spec.md`. Before assigning subagents, ask one research-depth question using `A.`, `B.`, `C.`, `D.` choices, exactly one recommended choice, and `D.` for custom research direction. Use the answer to choose research lanes, subagent count, whether to include web/current-state research, and whether additional rounds are useful. Default to the lightest research level that can produce a reliable plan, and make that default the recommended choice.

Split research questions into independent lanes and assign lanes to subagents. Run lanes in parallel. Standard lanes are:

- Existing implementation and ownership.
- Repo guidance and constraints.
- Validation/build/CI/browser QA.
- Web/current-state docs or package/API behavior when external facts affect decisions.
- UX/product behavior and edge cases.
- Migration/compatibility/security risks.
- Prior artifacts or similar features.

Include web/current-state research when external facts, current behavior, packages, APIs, platforms, best practices, or comparisons affect the plan. Add rounds when findings conflict, important questions remain, or design choices lack evidence.

Synthesize subagent results into `plan.md` decisions. Record questions, selected research depth, lanes, subagent results, sources, skipped lanes, additional rounds, remaining unknowns, and decisions in `research.md`.

## Memo Repo Guidance

Prefer the existing lightweight architecture:

- Vanilla TypeScript owns editor state, rendering, keyboard shortcuts, search, tabs, theme, and pointer-based drag/reorder.
- Rust/Tauri owns persistence, file metadata, app data paths, and thin IPC commands.
- Memo bodies remain plain markdown files under app data. Metadata remains in `state.json`.
- Keep sidebar titles based on the first non-empty markdown line, with empty memos displayed as `Untitled memo`.
- Avoid frontend frameworks, rich-text storage, markdown rendering, manual save flows, and file associations unless explicitly requested.
- Use pointer events for memo/tab DnD because native drag events can be intercepted by desktop webview behavior.

Validation baseline for user-facing app changes:

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `(cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --lib)`
- `npm run tauri build`

For user-facing app changes, plan to replace `/Applications/Memo.app` with `src-tauri/target/release/bundle/macos/Memo.app` and verify launch unless the user says not to.

## Branch, Commit, Push

Use the current branch if it is already appropriate for the feature; otherwise create a `codex/<short-feature-slug>` branch. Record branch action and share status in `todo.md`.

Commit only after artifact validation passes. Commit message should make clear this is a planning package. Push the branch and report the result. If commit or push is blocked, report the blocker and required next input without starting implementation.

## Goal Prompt Rules

`goal-prompt.md` must be a compact implementation prompt for a later `/goal` run. It must tell the implementation run to read `spec.md`, `research.md`, `plan.md`, and `todo.md`; continue on the recorded branch; follow the selected tier; validate; run phase-level subagent review before completing each phase; update evidence in `todo.md`; and stop on completion, blocker, unsafe branch state, or scope expansion.

Do not include planning-run continuation language, automatic `/goal` invocation, or instructions to begin `P001` from the planning run.
