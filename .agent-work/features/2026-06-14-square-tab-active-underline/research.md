# Research: Square Tab Active Underline

## Freshness Check

- Command: `node .agents/skills/memo-feature-planning/scripts/check-freshness.mjs`
- Result: clean for 29 watched files.

## Research Questions

- Which files own tab rendering and active-tab visual state?
- What current CSS creates rounded tabs and the active glow/top highlight?
- Can the requested change remain visual-only without touching tab state, persistence, or drag logic?
- What validation and QA are proportionate for a user-facing CSS change?

## Subagent Research Plan

- Lane 1: Existing tab UI implementation and QA risks. Inspect tab render/CSS/drag ownership and report likely approach. Expected sources: `src/ui/render.ts`, `src/styles.css`, `src/interaction/drag.ts`.

## Subagent Results

- Lane 1: The active tab class is added in `src/ui/render.ts` by `tabItem()`. The relevant visual selectors are in `src/styles.css`: `.tabs`, `.tab`, `.tab.is-active`, `.tab.is-active::after`, `.tab-main`, and `.tab-close`. Pointer-based tab drag relies on `[data-tab-id]`, `.tabs`, and `.tab-close` in `src/interaction/drag.ts`, so scoped CSS changes should not affect behavior. Current rounded corners come from `.tab { border-radius: 6px 6px 0 0; }`. Current active top highlight/glow comes from `.tab.is-active` `box-shadow`. The existing `.tab.is-active::after` masks the bottom border and can be repurposed for the bottom selection line.

## Repository Context

- `AGENTS.md`: Keep the app lightweight; vanilla TypeScript owns tabs and pointer-based DnD; Rust/Tauri owns persistence and thin IPC. Before declaring implementation done, run lint, typecheck, tests, Rust validation, and Tauri build; for user-facing app changes, install and verify the macOS app unless told not to.
- `README.md`: Open tabs are persistent and support keyboard navigation and drag-and-drop reordering.
- `.agents/skills/memo-feature-planning/references/repo-research-summary.md`: The repository is a Tauri 2 + vanilla TypeScript app, and user-facing validation includes frontend, Rust, and release build checks.

## Current Behavior

- `src/ui/render.ts` renders each open tab with class `tab`, adding `is-active` when `state.activeId === id`.
- `src/styles.css` gives tabs rounded top corners with `border-radius: 6px 6px 0 0`.
- `src/styles.css` gives active tabs a theme-aware active border/background plus `box-shadow` with an inset top line and faint top glow.
- `src/styles.css` currently uses `.tab.is-active::after` as a 1px strip matching the active tab background at the bottom edge.
- `src/interaction/drag.ts` handles tab drag/reorder through pointer events and DOM data attributes, independent of the active-tab visual treatment.

## Relevant Files

- `src/styles.css`: Primary implementation surface for square corners and bottom active line.
- `src/ui/render.ts`: Confirms active-tab class ownership; no planned logic change.
- `src/interaction/drag.ts`: Confirms pointer-based drag selectors and QA coverage.
- `AGENTS.md`: Validation and user-facing app follow-through requirements.
- `README.md`: Public tab behavior to preserve.

## External Or Time-Sensitive Facts

- None. This plan depends only on local CSS and repository guidance.

## Sources

- `AGENTS.md`: Project rules and validation baseline.
- `README.md`: Existing tab features and keyboard shortcuts.
- `src/styles.css`: Current tab styling, theme tokens, and active-tab visual behavior.
- `src/ui/render.ts`: Tab markup and active class assignment.
- `src/interaction/drag.ts`: Pointer-based tab drag ownership.
- `.agents/skills/memo-feature-planning/references/artifact-contract.md`: Planning artifact requirements.
- `.agents/skills/memo-feature-planning/references/freshness-policy.md`: Freshness procedure.
- `.agents/skills/memo-feature-planning/references/repo-research-summary.md`: Current repo summary.

## Synthesis

The requested behavior can be implemented as a scoped CSS update. The active-tab state already exists as `.tab.is-active`, and the current pseudo-element can be reused for a bottom selection line. No data model, Tauri command, Rust persistence, renderer markup, or drag logic changes are expected. The main design detail is whether to remove the now-unused `--tab-active-top` token or repurpose it; because the user asked for a bottom selection color, using the existing `--active-line` token is the lowest-risk choice.

## Constraints

- Keep Memo lightweight and avoid new dependencies.
- Preserve pointer-based DnD behavior and selectors.
- Preserve tab layout dimensions and hit targets.
- Use existing theme-aware CSS variables where possible.
- Follow full repo validation for user-facing app changes during implementation.

## Risks

- Bottom line contrast could be insufficient in one theme if the wrong token is used.
- Removing the active-tab bottom mask could make the tab/editor boundary look unintentionally broken.
- A line positioned outside the tab could be clipped or interfere with horizontal scrolling.
- Unused theme variables could remain after removing the top highlight.

## Decisions

- Implement as Tier S: one scoped CSS phase.
- Use `src/styles.css` as the only expected changed source file.
- Prefer `--active-line` for the bottom selection line because it is already theme-aware and used for active selection elsewhere.
- Do not change `src/ui/render.ts` unless implementation evidence shows CSS alone is insufficient.
- Treat browser/app QA as required because the change is user-facing and visual.

## Rejected Approaches

- Add a new active-tab class in TypeScript: rejected because `.tab.is-active` already exists.
- Add a new dependency or component system: rejected because this is a simple visual change and violates lightweight repo guidance.
- Change tab height or grid sizing to fit the underline: rejected because the line can be layered without layout changes.

## Skipped Research

- External package or browser documentation: skipped because no external API, package behavior, law, pricing, or current standard affects this CSS-only plan.
- Persistence/security migration research: skipped because no data or backend behavior changes are in scope.

## Additional Rounds

- None.

## Remaining Unknowns

- None expected. The implementation run should still visually verify line thickness and contrast.
