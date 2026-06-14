# TODO: Square Tab Active Underline

## Branch State

- branch: `codex/square-tab-active-underline`
- branch action: created from `main` for this planning package
- share status: planning package pending validation, commit, and push

## Execution Mode

Tier S: small, low-risk change

## Phase Checklist

- [x] `P001` CSS tab active-state update
  - goal: Make tabs square and represent the active tab with a colored bottom line instead of a top glow/highlight.
  - scope: CSS-only tab styling unless implementation evidence shows a minimal related cleanup is necessary.
  - expected files/areas: `src/styles.css`
  - validation: full repo validation from `plan.md`, plus app/browser visual QA for tabs in light and dark themes.
  - tasks:
    - [x] `T001` Make tab corners square
      - expected files/areas: `src/styles.css`
      - validation note: Confirm `.tab` no longer renders rounded top corners.
    - [x] `T002` Replace active glow with bottom selection line
      - expected files/areas: `src/styles.css`
      - validation note: Confirm `.tab.is-active` no longer has top inset/glow and `.tab.is-active::after` renders a visible bottom line.
    - [x] `T003` Verify behavior and visual QA
      - expected files/areas: `src/styles.css`, running app
      - validation note: Run required commands, check light/dark tabs, scrolling tabs, close button, activation, keyboard navigation, and pointer tab reordering.

## Evidence Summary

Implementation: Updated `src/styles.css` only. Tabs now use `border-radius: 0`; active tab no longer uses the previous top inset/glow `box-shadow`; `.tab.is-active::after` renders a 3px `--active-line` bottom line with `pointer-events: none`; removed unused `--tab-active-top` variables.
Validation: Passed `npm run lint`, `npm run typecheck`, `npm run test:run` (22 tests), `(cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --lib)` (4 Rust tests), and `npm run tauri build`.
Review: Phase-level subagent review found one P2 issue: active underline pseudo-element needed `pointer-events: none` to preserve bottom-edge activation. Fixed and reran validation/QA.
Browser QA: Localhost CSS harness using real `src/styles.css` confirmed light/dark active and inactive tabs have `border-radius: 0px`; active tab has `box-shadow: none`; active underline is 3px with `--active-line`; tab height remains 35px; grid columns remain `154px 26px`; scroll container remains `overflow-x: auto` with `scrollWidth > clientWidth`; active underline has `pointer-events: none`; bottom-edge click targets the active tab button.
Commit/Push: Pending implementation commit and push.
PR/CI: Pending PR creation and CI watch.
Notes: Replaced `/Applications/Memo.app` with `src-tauri/target/release/bundle/macos/Memo.app` after the final build and verified the installed `Memo` process launches.

## Blockers

- None.
