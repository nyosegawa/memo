# Memo Repo Research Summary

Last refreshed: 2026-06-14

## Repository Identity And Purpose

`memo` is an ultra-lightweight macOS memo app built with Tauri 2, vanilla TypeScript, and a Rust file-store backend. It stores memo bodies as plain markdown files and keeps memo order, open tabs, active tab, and theme in metadata.

## Tech Stack

- Frontend: vanilla TypeScript, Vite, Vitest with `happy-dom`, Biome.
- Desktop shell: Tauri 2.
- Backend: Rust 2024 with `serde`, `serde_json`, `tauri`, and macOS window helpers.
- Package manager: npm with `package-lock.json`.
- Rust lockfile: `src-tauri/Cargo.lock`.

## Commands

- Install: `npm ci` for CI parity or `npm install` for local development.
- Dev server: `npm run dev` on port 1420.
- Desktop dev: `npm run tauri dev`.
- Frontend lint: `npm run lint`.
- Frontend typecheck: `npm run typecheck`.
- Frontend tests: `npm run test:run`.
- Frontend build: `npm run build`.
- Rust tests: `(cd src-tauri && cargo test --lib)`.
- Rust full validation: `(cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --lib)`.
- Release bundle: `npm run tauri build`.

## CI And Release

- `.github/workflows/ci.yml` runs on pushes and PRs to `main`.
- CI matrix is `ubuntu-22.04`, `macos-latest`, and `windows-latest`.
- CI uses Node 22, Rust stable with rustfmt/clippy, npm cache, Rust cache, Linux Tauri deps, then lint/typecheck/test/Rust fmt/Rust clippy/Rust tests/build.
- `.github/workflows/release.yml` builds macOS universal bundles on `v*` tags or manual dispatch, validates lint/typecheck/test/Rust tests, and creates a draft release through `tauri-action`.

## Branch And Commit Conventions

- Default base branch is `main`.
- Use `codex/<short-feature-slug>` when creating a new planning branch.
- Planning and implementation use the same branch.
- Commit the validated planning package before push and stop before implementation.

## Generated Files And Lockfiles

- Preserve `package-lock.json` when npm dependency changes occur.
- Preserve `src-tauri/Cargo.lock` when Rust dependency changes occur.
- Treat `dist/` and `src-tauri/target/` as generated outputs, not planning artifacts.
- App bundles are generated under `src-tauri/target/release/bundle/macos/`.

## Files And Directories Requiring Care

- `AGENTS.md`: mandatory repo guidance, validation expectations, and app-install follow-through.
- `README.md`: public feature and storage behavior.
- `src/main.ts`: main frontend workflow, autosave, tabs, keyboard behavior, rendering.
- `src/app/model.ts`: pure model helpers and editor behavior suitable for Vitest coverage.
- `src/app/state.ts`: in-memory frontend state.
- `src/interaction/drag.ts`: pointer-based drag and reorder behavior.
- `src/ui/render.ts` and `src/ui/html.ts`: HTML rendering surface.
- `src-tauri/src/store.rs`: persistence, memo metadata, title extraction, and Rust tests.
- `src-tauri/src/commands.rs`: thin Tauri IPC command surface.
- `src-tauri/tauri.conf.json`: app identity, dev URL, window, bundle targets.

## Agent Guidance Inspected

- `AGENTS.md`
- `README.md`
- `package.json`
- `src-tauri/Cargo.toml`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- representative frontend and Rust source files

## Existing Planning Conventions

- No prior `.agents/skills` or `.agent-work/features` planning artifacts were present before this skill was created.
- Planning packages must use `.agent-work/features/<date>-<slug>/`.
- Artifacts must use repository-relative paths.

## Assumptions And Unknowns

- PR creation is expected for repository changes unless a later user instruction says not to.
- Browser QA for installed macOS app launch may require local macOS UI access.
- External dependency behavior and current package docs must be checked live when they affect a plan.
