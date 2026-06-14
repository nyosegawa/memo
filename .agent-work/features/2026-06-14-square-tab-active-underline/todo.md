# TODO: Square Tab Active Underline

## Branch State

- branch: `codex/square-tab-active-underline`
- branch action: created from `main` for this planning package
- share status: planning package pending validation, commit, and push

## Execution Mode

Tier S: small, low-risk change

## Phase Checklist

- [ ] `P001` CSS tab active-state update
  - goal: Make tabs square and represent the active tab with a colored bottom line instead of a top glow/highlight.
  - scope: CSS-only tab styling unless implementation evidence shows a minimal related cleanup is necessary.
  - expected files/areas: `src/styles.css`
  - validation: full repo validation from `plan.md`, plus app/browser visual QA for tabs in light and dark themes.
  - tasks:
    - [ ] `T001` Make tab corners square
      - expected files/areas: `src/styles.css`
      - validation note: Confirm `.tab` no longer renders rounded top corners.
    - [ ] `T002` Replace active glow with bottom selection line
      - expected files/areas: `src/styles.css`
      - validation note: Confirm `.tab.is-active` no longer has top inset/glow and `.tab.is-active::after` renders a visible bottom line.
    - [ ] `T003` Verify behavior and visual QA
      - expected files/areas: `src/styles.css`, running app
      - validation note: Run required commands, check light/dark tabs, scrolling tabs, close button, activation, keyboard navigation, and pointer tab reordering.

## Evidence Summary

Implementation:
Validation:
Review:
Browser QA:
Commit/Push:
PR/CI:
Notes:

## Blockers

- None.
