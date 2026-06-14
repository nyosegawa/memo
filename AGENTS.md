# memo — Agent Guidelines

Ultra-lightweight macOS memo app (Tauri 2 + vanilla TypeScript, Rust file-store backend).

## Commands

```bash
npm run dev             # Vite dev server (1420)
npm run tauri dev       # Desktop app with live reload
npm run typecheck       # tsc --noEmit
npm run lint            # biome check .
npm run test:run        # Vitest pure frontend tests
(cd src-tauri && cargo test --lib)
(cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo fmt --check)
npm run tauri build     # Release app/dmg bundle
```

## Rules

- Keep the app lightweight. Avoid frontend frameworks and runtime dependencies unless they remove substantial complexity.
- Memo bodies are plain markdown files under app data; keep order, open tabs, active tab, and theme in metadata.
- Do not add markdown rendering, rich-text storage, manual save flows, or file associations unless explicitly requested.
- Sidebar titles come from the first non-empty markdown line, with empty memos shown as `Untitled memo`.
- Tauri IPC stays thin: Rust owns persistence and file metadata; TypeScript owns editor state, keyboard shortcuts, and pointer-based DnD.
- Pointer-based DnD is intentional. Native drag events can be intercepted by desktop webview behavior, so use pointer events for memo and tab reordering.
- Before declaring done, run `npm run lint`, `npm run typecheck`, `npm run test:run`, `(cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --lib)`, and `npm run tauri build`.
- For user-facing app changes, unless explicitly told not to, replace `/Applications/Memo.app` with `src-tauri/target/release/bundle/macos/Memo.app` and verify the installed app launches.
- For repository changes, unless explicitly told not to, commit, push, and watch the GitHub Actions run until it succeeds or fails.
- When writing a name in a license file, use `{year} Sakasegawa`. Confirm the current year using `date +%Y`.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
