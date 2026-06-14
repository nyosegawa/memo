# Spec: Square Tab Active Underline

## Request

The user wants Memo's open tabs to use square corners instead of rounded corners. The selected tab should no longer appear to glow or show a top highlight; selection should be indicated by a colored line at the bottom of the tab.

## User Value

The tab bar should feel flatter and clearer, with active selection shown in a familiar underline style instead of a highlighted tab cap.

## User Scenarios

- As a user with multiple open memos, I can identify the active tab by a colored line along the bottom of that tab.
- As a user scanning the tab bar, I see square tab shapes without rounded top corners.
- As a user switching themes, I can still identify the active tab in light, dark, and system-driven themes.

## Functional Requirements

- Tabs MUST render with square corners.
- The active tab MUST NOT use the existing top inset highlight or glow-like shadow.
- The active tab MUST show a colored selection line along the bottom edge of the tab.
- The active selection line MUST use an existing theme-aware selection color unless implementation evidence shows a better existing token.
- Tab dimensions, title truncation, close button behavior, horizontal scrolling, and pointer-based tab reordering MUST remain unchanged.
- The change MUST remain visual-only unless implementation evidence shows a required minimal class or token cleanup.

## Success Criteria

- In the running app, inactive and active tabs have `border-radius: 0`.
- The active tab has no top colored inset or shadow glow.
- The active tab has a visible bottom selection line in light and dark themes.
- Existing tab activation, closing, keyboard navigation, and pointer-based tab reordering continue to work.

## Edge Cases

- The bottom selection line must remain visible when the tab bar has many horizontally scrollable tabs.
- The bottom selection line must not obscure the drag drop marker or close button hit target.
- Removing the current active-tab bottom mask must not create an unintended visual break between the active tab and editor area.

## Assumptions

- The desired "selection color" is the existing `--active-line` color unless the implementation run finds a more appropriate existing theme token.
- A 2px or 3px bottom line is acceptable if it is visually clear and does not change layout height.
- No persistence, IPC, markdown storage, or Rust backend behavior changes are required.
- Specify checkpoint: no user clarification was needed because the request clearly defined the UX direction and scope.

## Non-Goals

- No redesign of the entire tab bar.
- No changes to memo ordering, open-tab persistence, active-tab state, keyboard shortcuts, or drag behavior.
- No new frontend framework, runtime dependency, theme system, or markdown rendering behavior.
- No changes to sidebar active-row styling.

## Open Questions

- None.

## Clarification Log

- 2026-06-14: User requested square tabs and active selection as a colored bottom line instead of the current glowing/top-highlighted active tab. Treated as a bounded visual-only tab bar change. Assumed existing theme-aware selection color is acceptable.

## Quality Checklist

- [x] User-visible behavior is clear.
- [x] Requirements are testable.
- [x] Scope is bounded.
- [x] No unresolved clarification markers remain.
