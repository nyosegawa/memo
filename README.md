# Memo

Ultra-lightweight macOS memo app built with Rust and Tauri.

## Features

- Plain markdown files for memo data. No markdown rendering and no rich-text storage.
- Persistent left sidebar with memo order, title extracted from the first meaningful markdown line, creation time, and update time.
- Persistent open tabs with keyboard navigation.
- Light and dark themes.
- Drag-and-drop reordering for sidebar memos and open tabs.
- No file associations.

## Shortcuts

- `Cmd/Ctrl+N`: New memo
- `Cmd/Ctrl+W`: Close active tab
- `Ctrl+Tab`: Next tab
- `Ctrl+Shift+Tab`: Previous tab
- `Cmd/Ctrl+1` ... `Cmd/Ctrl+9`: Activate tab by index
- `Cmd/Ctrl+Backspace`: Delete active memo

## Storage

Memo stores app data under the platform app data directory for `com.nyosegawa.memo`.

- `memos/*.md`: memo bodies
- `state.json`: memo order, open tabs, active tab, and theme

## Development

```sh
npm install
npm run tauri dev
```

Validation:

```sh
npm run typecheck
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```
