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

const STATE_FILE: &str = "state.json";
const MEMOS_DIR: &str = "memos";
const UNTITLED: &str = "Untitled memo";

#[derive(Debug)]
pub(crate) struct MemoStore {
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
pub(crate) enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WindowState {
    pub(crate) x: i32,
    pub(crate) y: i32,
    pub(crate) width: u32,
    pub(crate) height: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppSnapshot {
    memos: Vec<MemoSummary>,
    open_tabs: Vec<String>,
    active_id: Option<String>,
    theme: Theme,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoSummary {
    id: String,
    title: String,
    created_at_ms: u128,
    updated_at_ms: u128,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemoDocument {
    summary: MemoSummary,
    content: String,
}

impl MemoStore {
    pub(crate) fn new(root: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(root.join(MEMOS_DIR)).map_err(to_message)?;
        let state = read_state(&root).map_err(to_message)?;
        Ok(Self {
            root,
            serial: AtomicU64::new(0),
            inner: Mutex::new(state),
        })
    }

    pub(crate) fn snapshot(&self) -> Result<AppSnapshot, String> {
        let state = self.inner.lock().map_err(|err| err.to_string())?;
        self.snapshot_locked(&state)
    }

    pub(crate) fn create_memo(&self) -> Result<MemoDocument, String> {
        let mut state = self.inner.lock().map_err(|err| err.to_string())?;
        let now = unix_ms();
        let id = self.new_id();
        let record = MemoRecord {
            file_name: format!("{id}.md"),
            id,
            created_at_ms: now,
            updated_at_ms: now,
        };
        fs::write(self.memo_path(&record), "").map_err(to_message)?;
        state.open_tabs.retain(|open_id| open_id != &record.id);
        state.open_tabs.push(record.id.clone());
        state.active_id = Some(record.id.clone());
        state.memos.insert(0, record.clone());
        self.persist(&state)?;
        Ok(MemoDocument {
            summary: self.summary_for(&record)?,
            content: String::new(),
        })
    }

    pub(crate) fn read_memo(&self, id: &str) -> Result<MemoDocument, String> {
        let state = self.inner.lock().map_err(|err| err.to_string())?;
        let record = find_record(&state, id)?;
        let content = fs::read_to_string(self.memo_path(record)).map_err(to_message)?;
        Ok(MemoDocument {
            summary: self.summary_for(record)?,
            content,
        })
    }

    pub(crate) fn save_memo(&self, id: &str, content: String) -> Result<MemoSummary, String> {
        let mut state = self.inner.lock().map_err(|err| err.to_string())?;
        let index = state
            .memos
            .iter()
            .position(|record| record.id == id)
            .ok_or_else(|| "memo not found".to_string())?;
        let path = self.memo_path(&state.memos[index]);
        fs::write(path, content).map_err(to_message)?;
        state.memos[index].updated_at_ms = unix_ms();
        self.persist(&state)?;
        self.summary_for(&state.memos[index])
    }

    pub(crate) fn delete_memo(&self, id: &str) -> Result<AppSnapshot, String> {
        let mut state = self.inner.lock().map_err(|err| err.to_string())?;
        let index = state
            .memos
            .iter()
            .position(|record| record.id == id)
            .ok_or_else(|| "memo not found".to_string())?;
        let record = state.memos.remove(index);
        match fs::remove_file(self.memo_path(&record)) {
            Ok(()) => {}
            Err(err) if err.kind() == io::ErrorKind::NotFound => {}
            Err(err) => return Err(to_message(err)),
        }
        state.open_tabs.retain(|open_id| open_id != id);
        if state.active_id.as_deref() == Some(id) {
            state.active_id = state.open_tabs.first().cloned();
        }
        self.persist(&state)?;
        self.snapshot_locked(&state)
    }

    pub(crate) fn reorder_memos(&self, ids: Vec<String>) -> Result<AppSnapshot, String> {
        let mut state = self.inner.lock().map_err(|err| err.to_string())?;
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
        self.persist(&state)?;
        self.snapshot_locked(&state)
    }

    pub(crate) fn persist_tabs(
        &self,
        open_tabs: Vec<String>,
        active_id: Option<String>,
    ) -> Result<(), String> {
        let mut state = self.inner.lock().map_err(|err| err.to_string())?;
        let known = state
            .memos
            .iter()
            .map(|record| record.id.as_str())
            .collect::<Vec<_>>();
        state.open_tabs = open_tabs
            .into_iter()
            .filter(|id| known.contains(&id.as_str()))
            .collect();
        state.active_id =
            active_id.filter(|id| state.open_tabs.iter().any(|open_id| open_id == id));
        self.persist(&state)
    }

    pub(crate) fn set_theme(&self, theme: Theme) -> Result<(), String> {
        let mut state = self.inner.lock().map_err(|err| err.to_string())?;
        state.theme = theme;
        self.persist(&state)
    }

    pub(crate) fn window_state(&self) -> Option<WindowState> {
        let Ok(state) = self.inner.lock() else {
            return None;
        };
        state.window_state
    }

    pub(crate) fn set_window_state(&self, window_state: WindowState) -> Result<(), String> {
        let mut state = self.inner.lock().map_err(|err| err.to_string())?;
        state.window_state = Some(window_state);
        self.persist(&state)
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
