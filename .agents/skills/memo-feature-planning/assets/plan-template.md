# Plan: <feature title>

## Summary

<Short technical plan summary.>

## Goals

- <Goal 1>

## Non-Goals

- <Non-goal 1>

## User-Facing Behavior

<What changes for the user.>

## Technical Approach

<How this fits the vanilla TypeScript + Rust/Tauri architecture.>

## Files And Ownership

- `<repo-root-relative-path>`: <planned ownership/change>

## Data Or API Changes

- <IPC, persistence, metadata, or no change>

## Compatibility And Migration

- <Compatibility/migration plan or "None">

## Generated Files

- <Generated outputs or "None">

## Validation Strategy

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `(cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --lib)`
- `npm run tauri build`

## Review Strategy

<Phase-level review expectations and focus areas.>

## Browser QA Strategy

<Browser/app QA plan scaled to feature risk.>

## Commit And PR Strategy

<Commit/push/PR/CI plan.>

## Risks And Mitigations

- <Risk and mitigation>

## Phase Overview

- `P001`: <phase title and purpose>

## Decisions

- <Decision and rationale>
