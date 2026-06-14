# Freshness Policy

Use `scripts/check-freshness.mjs` before relying on this skill's repository guidance.

## Summarized Repo Inputs

This skill summarizes:

- `AGENTS.md`
- `README.md`
- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- selected source files under `src/` and `src-tauri/src/`
- generated skill files under `.agents/skills/memo-feature-planning/`

## Targeted Refresh Triggers

Refresh the affected reference/template/validator content when:

- repo commands, scripts, Node/Rust versions, or dependency managers change;
- CI or release workflows change;
- app architecture, storage layout, IPC ownership, or drag behavior changes;
- `AGENTS.md` or `README.md` changes;
- planning artifact contract or goal prompt boundary changes;
- validation command expectations change.

## Full Refresh Triggers

Do a full repo research refresh when:

- Tauri, Vite, TypeScript, Rust edition, package manager, or testing stack changes substantially;
- the app adds a framework, database, renderer, sync layer, file associations, or rich-text behavior;
- the planning package directory or required artifact set changes;
- repeated freshness failures indicate the manifest no longer reflects the repo.

## Fallback Procedure

If freshness cannot be confirmed:

1. Do not rely blindly on `repo-research-summary.md`.
2. Re-read `AGENTS.md`, `README.md`, package and Rust manifests, CI workflows, and relevant source files.
3. Record the failure and the manual refresh performed in `research.md`.
4. Update `repo-research-summary.md`, templates, scripts, and `freshness-manifest.json` before committing a planning package when the changes are material.
