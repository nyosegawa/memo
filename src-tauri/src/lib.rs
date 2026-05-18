use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::{Path, PathBuf},
    sync::{
        Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{Manager, PhysicalPosition, PhysicalSize, State, WebviewWindow, Window, WindowEvent};

const STATE_FILE: &str = "state.json";
const MEMOS_DIR: &str = "memos";
const UNTITLED: &str = "Untitled memo";

#[derive(Debug)]
struct MemoStore {
    root: PathBuf,
    serial: AtomicU64,
    inner: Mutex<PersistedState>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PersistedState {
    memos: Vec<MemoRecord>,
    open_tabs: Vec<String>,
    active_id: Option<String>,
    theme: Theme,
    #[serde(default)]
    window_state: Option<WindowState>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MemoRecord {
    id: String,
    file_name: String,
    created_at_ms: u128,
    updated_at_ms: u128,
}

#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppSnapshot {
    memos: Vec<MemoSummary>,
    open_tabs: Vec<String>,
    active_id: Option<String>,
    theme: Theme,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MemoSummary {
    id: String,
    title: String,
    created_at_ms: u128,
    updated_at_ms: u128,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MemoDocument {
    summary: MemoSummary,
    content: String,
}

impl MemoStore {
    fn new(root: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(root.join(MEMOS_DIR)).map_err(to_message)?;
        let state = read_state(&root).map_err(to_message)?;
        Ok(Self {
            root,
            serial: AtomicU64::new(0),
            inner: Mutex::new(state),
        })
    }

    fn snapshot(&self) -> Result<AppSnapshot, String> {
        let state = self.inner.lock().map_err(|err| err.to_string())?;
        self.snapshot_locked(&state)
    }

    fn snapshot_locked(&self, state: &PersistedState) -> Result<AppSnapshot, String> {
        let memos = state
            .memos
            .iter()
            .map(|record| self.summary_for(record))
            .collect::<Result<Vec<_>, _>>()?;
        let memo_ids = state
            .memos
            .iter()
            .map(|record| record.id.as_str())
            .collect::<Vec<_>>();
        let open_tabs = state
            .open_tabs
            .iter()
            .filter(|id| memo_ids.contains(&id.as_str()))
            .cloned()
            .collect::<Vec<_>>();
        let active_id = state
            .active_id
            .as_ref()
            .filter(|id| open_tabs.iter().any(|open_id| open_id == *id))
            .cloned()
            .or_else(|| open_tabs.first().cloned());
        Ok(AppSnapshot {
            memos,
            open_tabs,
            active_id,
            theme: state.theme,
        })
    }

    fn memo_path(&self, record: &MemoRecord) -> PathBuf {
        self.root.join(MEMOS_DIR).join(&record.file_name)
    }

    fn summary_for(&self, record: &MemoRecord) -> Result<MemoSummary, String> {
        let content = fs::read_to_string(self.memo_path(record)).unwrap_or_default();
        Ok(MemoSummary {
            id: record.id.clone(),
            title: title_from_markdown(&content),
            created_at_ms: record.created_at_ms,
            updated_at_ms: record.updated_at_ms,
        })
    }

    fn persist(&self, state: &PersistedState) -> Result<(), String> {
        let path = self.root.join(STATE_FILE);
        let json = serde_json::to_string_pretty(state).map_err(to_message)?;
        fs::write(path, json).map_err(to_message)
    }

    fn new_id(&self) -> String {
        let now = unix_ms();
        let serial = self.serial.fetch_add(1, Ordering::Relaxed);
        format!("{now:x}-{serial:x}")
    }
}

#[tauri::command]
fn list_memos(store: State<'_, MemoStore>) -> Result<AppSnapshot, String> {
    store.snapshot()
}

#[tauri::command]
fn create_memo(store: State<'_, MemoStore>) -> Result<MemoDocument, String> {
    let mut state = store.inner.lock().map_err(|err| err.to_string())?;
    let now = unix_ms();
    let id = store.new_id();
    let record = MemoRecord {
        file_name: format!("{id}.md"),
        id,
        created_at_ms: now,
        updated_at_ms: now,
    };
    fs::write(store.memo_path(&record), "").map_err(to_message)?;
    state.open_tabs.retain(|open_id| open_id != &record.id);
    state.open_tabs.push(record.id.clone());
    state.active_id = Some(record.id.clone());
    state.memos.insert(0, record.clone());
    store.persist(&state)?;
    Ok(MemoDocument {
        summary: store.summary_for(&record)?,
        content: String::new(),
    })
}

#[tauri::command]
fn read_memo(id: String, store: State<'_, MemoStore>) -> Result<MemoDocument, String> {
    let state = store.inner.lock().map_err(|err| err.to_string())?;
    let record = find_record(&state, &id)?;
    let content = fs::read_to_string(store.memo_path(record)).map_err(to_message)?;
    Ok(MemoDocument {
        summary: store.summary_for(record)?,
        content,
    })
}

#[tauri::command]
fn save_memo(
    id: String,
    content: String,
    store: State<'_, MemoStore>,
) -> Result<MemoSummary, String> {
    let mut state = store.inner.lock().map_err(|err| err.to_string())?;
    let index = state
        .memos
        .iter()
        .position(|record| record.id == id)
        .ok_or_else(|| "memo not found".to_string())?;
    let path = store.memo_path(&state.memos[index]);
    fs::write(path, content).map_err(to_message)?;
    state.memos[index].updated_at_ms = unix_ms();
    store.persist(&state)?;
    store.summary_for(&state.memos[index])
}

#[tauri::command]
fn delete_memo(id: String, store: State<'_, MemoStore>) -> Result<AppSnapshot, String> {
    let mut state = store.inner.lock().map_err(|err| err.to_string())?;
    let index = state
        .memos
        .iter()
        .position(|record| record.id == id)
        .ok_or_else(|| "memo not found".to_string())?;
    let record = state.memos.remove(index);
    match fs::remove_file(store.memo_path(&record)) {
        Ok(()) => {}
        Err(err) if err.kind() == io::ErrorKind::NotFound => {}
        Err(err) => return Err(to_message(err)),
    }
    state.open_tabs.retain(|open_id| open_id != &id);
    if state.active_id.as_deref() == Some(&id) {
        state.active_id = state.open_tabs.first().cloned();
    }
    store.persist(&state)?;
    store.snapshot_locked(&state)
}

#[tauri::command]
fn reorder_memos(ids: Vec<String>, store: State<'_, MemoStore>) -> Result<AppSnapshot, String> {
    let mut state = store.inner.lock().map_err(|err| err.to_string())?;
    if ids.len() != state.memos.len() {
        return Err("memo order does not match current memo list".to_string());
    }
    let mut ordered = Vec::with_capacity(state.memos.len());
    for id in ids {
        let index = state
            .memos
            .iter()
            .position(|record| record.id == id)
            .ok_or_else(|| "memo order contains an unknown memo".to_string())?;
        ordered.push(state.memos.remove(index));
    }
    state.memos = ordered;
    store.persist(&state)?;
    store.snapshot_locked(&state)
}

#[tauri::command]
fn persist_tabs(
    open_tabs: Vec<String>,
    active_id: Option<String>,
    store: State<'_, MemoStore>,
) -> Result<(), String> {
    let mut state = store.inner.lock().map_err(|err| err.to_string())?;
    let known = state
        .memos
        .iter()
        .map(|record| record.id.as_str())
        .collect::<Vec<_>>();
    state.open_tabs = open_tabs
        .into_iter()
        .filter(|id| known.contains(&id.as_str()))
        .collect();
    state.active_id = active_id.filter(|id| state.open_tabs.iter().any(|open_id| open_id == id));
    store.persist(&state)
}

#[tauri::command]
fn set_theme(theme: Theme, store: State<'_, MemoStore>) -> Result<(), String> {
    let mut state = store.inner.lock().map_err(|err| err.to_string())?;
    state.theme = theme;
    store.persist(&state)
}

fn restore_window_state(window: &WebviewWindow, store: &MemoStore) {
    let Ok(state) = store.inner.lock() else {
        return;
    };
    let Some(window_state) = state.window_state else {
        return;
    };
    drop(state);

    let _ = window.set_size(PhysicalSize::new(window_state.width, window_state.height));
    let _ = window.set_position(PhysicalPosition::new(window_state.x, window_state.y));
}

fn persist_window_state(store: &MemoStore, window_state: WindowState) -> Result<(), String> {
    let mut state = store.inner.lock().map_err(|err| err.to_string())?;
    state.window_state = Some(window_state);
    store.persist(&state)
}

fn save_window_state(window: &Window, store: &MemoStore) -> Result<(), String> {
    if window.is_fullscreen().map_err(to_message)? || window.is_minimized().map_err(to_message)? {
        return Ok(());
    }

    let position = window.outer_position().map_err(to_message)?;
    let size = window.outer_size().map_err(to_message)?;
    persist_window_state(store, window_state_from_parts(position, size))
}

fn save_webview_window_state(window: &WebviewWindow, store: &MemoStore) -> Result<(), String> {
    if window.is_fullscreen().map_err(to_message)? || window.is_minimized().map_err(to_message)? {
        return Ok(());
    }

    let position = window.outer_position().map_err(to_message)?;
    let size = window.outer_size().map_err(to_message)?;
    persist_window_state(store, window_state_from_parts(position, size))
}

fn window_state_from_parts(
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
) -> WindowState {
    WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    }
}

fn read_state(root: &Path) -> io::Result<PersistedState> {
    let path = root.join(STATE_FILE);
    if !path.exists() {
        return Ok(PersistedState::default());
    }
    let raw = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

fn find_record<'a>(state: &'a PersistedState, id: &str) -> Result<&'a MemoRecord, String> {
    state
        .memos
        .iter()
        .find(|record| record.id == id)
        .ok_or_else(|| "memo not found".to_string())
}

fn title_from_markdown(content: &str) -> String {
    let Some(line) = content.lines().find(|line| !line.trim().is_empty()) else {
        return UNTITLED.to_string();
    };
    let trimmed = line.trim();
    let heading = trimmed
        .strip_prefix('#')
        .map(str::trim_start)
        .unwrap_or(trimmed);
    if heading.is_empty() {
        UNTITLED.to_string()
    } else {
        heading.to_string()
    }
}

fn unix_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis())
}

fn to_message(err: impl ToString) -> String {
    err.to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            app.manage(MemoStore::new(data_dir)?);
            if let Some(window) = app.get_webview_window("main") {
                window.set_title("")?;
                if let Some(store) = app.try_state::<MemoStore>() {
                    restore_window_state(&window, &store);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_memos,
            create_memo,
            read_memo,
            save_memo,
            delete_memo,
            reorder_memos,
            persist_tabs,
            set_theme,
        ])
        .on_window_event(|window, event| {
            let Some(store) = window.try_state::<MemoStore>() else {
                return;
            };
            match event {
                WindowEvent::Resized(_) | WindowEvent::Moved(_) => {
                    let _ = save_window_state(window, &store);
                }
                WindowEvent::CloseRequested { api, .. } => {
                    let _ = save_window_state(window, &store);
                    api.prevent_close();
                    let _ = window.hide();
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match event {
            tauri::RunEvent::ExitRequested { .. } => {
                if let Some(window) = app.get_webview_window("main")
                    && let Some(store) = app.try_state::<MemoStore>()
                {
                    let _ = save_webview_window_state(&window, &store);
                }
            }
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        });
}

#[cfg(test)]
mod tests {
    use super::{
        MEMOS_DIR, MemoRecord, MemoStore, PersistedState, Theme, read_state, title_from_markdown,
    };
    use std::fs;

    #[test]
    fn title_uses_first_non_empty_markdown_line() {
        assert_eq!(
            title_from_markdown("# Project notes\nbody"),
            "Project notes"
        );
        assert_eq!(title_from_markdown("\n\nplain title\nbody"), "plain title");
        assert_eq!(title_from_markdown(""), "Untitled memo");
    }

    #[test]
    fn store_starts_empty_and_creates_memo_directory() {
        let dir = tempfile::tempdir().expect("tempdir");
        let store = MemoStore::new(dir.path().to_path_buf()).expect("store");
        let snapshot = store.snapshot().expect("snapshot");

        assert!(dir.path().join(MEMOS_DIR).is_dir());
        assert!(snapshot.memos.is_empty());
        assert!(snapshot.open_tabs.is_empty());
        assert!(snapshot.active_id.is_none());
    }

    #[test]
    fn snapshot_filters_stale_tabs_and_uses_file_title() {
        let dir = tempfile::tempdir().expect("tempdir");
        let store = MemoStore::new(dir.path().to_path_buf()).expect("store");
        let record = MemoRecord {
            id: "memo-1".to_string(),
            file_name: "memo-1.md".to_string(),
            created_at_ms: 10,
            updated_at_ms: 20,
        };
        fs::write(store.memo_path(&record), "# Alpha\nbody").expect("write memo");
        let persisted = PersistedState {
            memos: vec![record],
            open_tabs: vec!["missing".to_string(), "memo-1".to_string()],
            active_id: Some("missing".to_string()),
            theme: Theme::Dark,
            window_state: None,
        };
        store.persist(&persisted).expect("persist");
        let reloaded = read_state(dir.path()).expect("read state");
        let snapshot = store.snapshot_locked(&reloaded).expect("snapshot");

        assert_eq!(snapshot.memos[0].title, "Alpha");
        assert_eq!(snapshot.open_tabs, ["memo-1"]);
        assert_eq!(snapshot.active_id.as_deref(), Some("memo-1"));
    }

    #[test]
    fn read_state_accepts_files_without_window_state() {
        let dir = tempfile::tempdir().expect("tempdir");
        fs::write(
            dir.path().join("state.json"),
            r##"{
  "memos": [
    {
      "id": "memo-1",
      "fileName": "memo-1.md",
      "createdAtMs": 10,
      "updatedAtMs": 20
    }
  ],
  "openTabs": ["memo-1"],
  "activeId": "memo-1",
  "theme": "dark"
}"##,
        )
        .expect("write state");

        let state = read_state(dir.path()).expect("read state");

        assert_eq!(state.memos.len(), 1);
        assert_eq!(state.open_tabs, ["memo-1"]);
        assert!(state.window_state.is_none());
    }
}
