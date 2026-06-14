# Planning Artifact Contract

All feature plans live under `.agent-work/features/<date>-<slug>/` and use repository-relative paths.

## `spec.md`

Required sections:

- `# Spec: <feature title>`
- `## Request`
- `## User Value`
- `## User Scenarios`
- `## Functional Requirements`
- `## Success Criteria`
- `## Edge Cases`
- `## Assumptions`
- `## Non-Goals`
- `## Open Questions`
- `## Clarification Log`
- `## Quality Checklist`

Rules:

- Focus on user-visible WHAT and WHY.
- Leave implementation details for `plan.md`.
- Requirements must be testable and unambiguous.
- Success criteria should be measurable when possible.
- Resolve scope, security/privacy, data, and UX ambiguity in the Specify Checkpoint.
- Do not continue with unresolved `[NEEDS CLARIFICATION: ...]` markers.
- Record choices, custom answers, assumptions, and unresolved tradeoffs in `Clarification Log`.

## `research.md`

Required sections:

- `# Research: <feature title>`
- `## Freshness Check`
- `## Research Questions`
- `## Subagent Research Plan`
- `## Subagent Results`
- `## Repository Context`
- `## Current Behavior`
- `## Relevant Files`
- `## External Or Time-Sensitive Facts`
- `## Sources`
- `## Synthesis`
- `## Constraints`
- `## Risks`
- `## Decisions`
- `## Rejected Approaches`
- `## Skipped Research`
- `## Additional Rounds`
- `## Remaining Unknowns`

Rules:

- Record freshness command and result.
- Record inspected repo guidance with repository-relative paths.
- Record lanes, assigned topics, subagent results, sources, and decisions.
- Use current web research for external APIs, packages, laws, pricing, schedules, standards, or product behavior that affect the plan.
- Explain skipped lanes.

## `plan.md`

Required sections:

- `# Plan: <feature title>`
- `## Summary`
- `## Goals`
- `## Non-Goals`
- `## User-Facing Behavior`
- `## Technical Approach`
- `## Files And Ownership`
- `## Data Or API Changes`
- `## Compatibility And Migration`
- `## Generated Files`
- `## Validation Strategy`
- `## Review Strategy`
- `## Browser QA Strategy`
- `## Commit And PR Strategy`
- `## Risks And Mitigations`
- `## Phase Overview`
- `## Decisions`

Rules:

- Match the existing TypeScript/Rust/Tauri ownership boundaries.
- Keep phases reviewable.
- Scale validation, browser QA, PR, and CI follow-through to feature risk.

## `todo.md`

Required sections:

- `# TODO: <feature title>`
- `## Branch State`
- `## Execution Mode`
- `## Phase Checklist`
- `## Evidence Summary`
- `## Blockers`

`Branch State` must include:

- branch
- branch action
- share status

`Execution Mode` must select one tier:

- `Tier S: small, low-risk change`
- `Tier M: ordinary feature or multi-file change`
- `Tier L: large, risky, cross-surface, migration, persistence, security, release, or hard-to-revert work`

Each phase must include:

- checkbox
- phase id such as `P001`
- title
- goal
- scope
- expected files/areas
- validation
- tasks

Each task must include:

- checkbox
- task id such as `T001`
- title
- expected files/areas when different from the phase
- validation note when different from the phase

`Evidence Summary` is the only implementation evidence aggregate and must contain:

- `Implementation:`
- `Validation:`
- `Review:`
- `Browser QA:`
- `Commit/Push:`
- `PR/CI:`
- `Notes:`

## `goal-prompt.md`

Required content:

- `/goal` command
- source artifacts
- repo guidance
- branch context
- execution mode
- implementation rules
- validation rules
- phase-level subagent review rules
- browser QA rules
- commit/push/PR/CI rules
- evidence rules
- stop conditions
- escalation conditions

Rules:

- Keep it copy-paste-ready for Codex `/goal`.
- Keep it at or below 4000 characters.
- Make it implementation-run-only.
- Include `spec.md`, `research.md`, `plan.md`, `todo.md`, and repo guidance as repository-relative paths.
- Instruct the implementation run to start from the repository root and continue on the branch recorded in `todo.md`.
- Require phase-level subagent review before marking each phase complete. If subagent tooling is unavailable, stop as blocked instead of silently skipping review.
- Do not include planning-run continuation language, automatic `/goal`, automatic `P001`, or instructions to begin implementation from the planning run.

## Validator Behavior

`scripts/validate-artifacts.mjs <feature-dir>` verifies:

- required files exist;
- required sections exist;
- `goal-prompt.md` is at most 4000 characters;
- artifacts do not contain user-local absolute paths;
- `todo.md` has branch state, execution mode, phase checklist, evidence summary, and blockers;
- `todo.md` contains at least one `P###` phase and one `T###` task unless explicitly validation-only;
- `goal-prompt.md` contains repository-root, branch-context, validation, phase-level subagent review, browser QA, commit/push/PR/CI, evidence, stop, and escalation rules;
- `goal-prompt.md` is not a planning-run continuation prompt.
