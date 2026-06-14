# Plan: Square Tab Active Underline

## Summary

Make Memo's tabs square and change the active-tab affordance from a top highlight/glow to a bottom selection line. Keep the change scoped to existing CSS and preserve all tab behavior.

## Goals

- Remove rounded corners from open tabs.
- Remove the active tab's top inset highlight and glow-like shadow.
- Add a theme-aware colored bottom line for the active tab.
- Preserve tab layout, close controls, keyboard activation, horizontal scrolling, and pointer-based reordering.

## Non-Goals

- No changes to tab state, persistence, keyboard shortcuts, or close/reorder logic.
- No broader app theme redesign.
- No Rust/Tauri IPC, file-store, or metadata changes.
- No new dependencies or framework changes.

## User-Facing Behavior

Tabs appear rectangular. The active tab is identified by a colored line along its bottom edge, while retaining the existing active background/text treatment as needed for readability. The active tab no longer has a colored top stripe or glow.

## Technical Approach

Update `src/styles.css` only:

- Change `.tab` from rounded top corners to square corners.
- Remove the active tab `box-shadow` that creates the top colored inset and glow.
- Rework `.tab.is-active::after` from a 1px bottom background mask into a 2px or 3px bottom selection line using `--active-line`.
- Keep dimensions, grid columns, min/max widths, close button styling, and pointer-event behavior unchanged.
- If `--tab-active-top` becomes unused, either remove it from theme variables or leave it only if implementation evidence shows it is still referenced elsewhere. Prefer cleanup when it is clearly unused and low risk.

## Files And Ownership

- `src/styles.css`: Planned CSS changes for tab corner radius, active-state shadow, active underline, and optional unused token cleanup.
- `src/ui/render.ts`: Ownership reference only; no planned change because it already emits `.tab.is-active`.
- `src/interaction/drag.ts`: Ownership reference only; no planned change because CSS should not affect pointer-based reordering.

## Data Or API Changes

- None. No IPC, persistence, metadata, markdown storage, or Rust command changes.

## Compatibility And Migration

- None. Existing saved state, open tabs, active tab, and theme metadata remain compatible.

## Generated Files

- Implementation validation will generate normal build outputs under ignored build directories only.

## Validation Strategy

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `(cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --lib)`
- `npm run tauri build`
- For the user-facing app change, replace the installed macOS app with the built bundle and verify launch unless a later instruction says not to.

## Review Strategy

After the CSS phase, request phase-level subagent review before marking the phase complete. The review should inspect the diff for missed selectors, unused variables, contrast regressions, layout changes, and repo-rule violations.

## Browser QA Strategy

Use the app/browser-visible surface to check:

- Active and inactive tabs have square corners.
- Active tab has a bottom colored line and no top glow/highlight.
- Light and dark themes show a visible active line.
- Multiple tabs still scroll horizontally.
- Tab activation, close button, keyboard tab navigation, and pointer-based tab reordering still work.

## Commit And PR Strategy

The implementation run should commit the completed feature after validation and review evidence is recorded. Per repo guidance, push the branch and create/follow a PR/CI unless a later instruction says not to.

## Risks And Mitigations

- Risk: the bottom line may be too subtle in dark or light theme. Mitigation: use `--active-line` and verify both themes.
- Risk: replacing the current bottom mask could make the active tab boundary look awkward. Mitigation: tune pseudo-element placement without changing layout dimensions.
- Risk: optional token cleanup could remove a still-used variable. Mitigation: use `rg` before removing `--tab-active-top`.

## Phase Overview

- `P001`: CSS tab active-state update. Make tabs square, replace active glow/top highlight with bottom line, validate, review, and perform visual QA.

## Decisions

- Tier S is sufficient because the expected implementation is a single CSS file with no data or logic changes.
- The bottom line should use an existing theme-aware selection token rather than introducing a new color system.
- Renderer and drag logic should remain unchanged unless CSS-only implementation proves insufficient.
