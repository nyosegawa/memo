use tauri::State;

use crate::store::{AppSnapshot, MemoDocument, MemoStore, MemoSummary, Theme};

#[tauri::command]
pub(crate) fn list_memos(store: State<'_, MemoStore>) -> Result<AppSnapshot, String> {
    store.snapshot()
}

#[tauri::command]
pub(crate) fn create_memo(store: State<'_, MemoStore>) -> Result<MemoDocument, String> {
    store.create_memo()
}

#[tauri::command]
pub(crate) fn read_memo(id: String, store: State<'_, MemoStore>) -> Result<MemoDocument, String> {
    store.read_memo(&id)
}

#[tauri::command]
pub(crate) fn save_memo(
    id: String,
    content: String,
    store: State<'_, MemoStore>,
) -> Result<MemoSummary, String> {
    store.save_memo(&id, content)
}

#[tauri::command]
pub(crate) fn delete_memo(id: String, store: State<'_, MemoStore>) -> Result<AppSnapshot, String> {
    store.delete_memo(&id)
}

#[tauri::command]
pub(crate) fn reorder_memos(
    ids: Vec<String>,
    store: State<'_, MemoStore>,
) -> Result<AppSnapshot, String> {
    store.reorder_memos(ids)
}

#[tauri::command]
pub(crate) fn persist_tabs(
    open_tabs: Vec<String>,
    active_id: Option<String>,
    store: State<'_, MemoStore>,
) -> Result<(), String> {
    store.persist_tabs(open_tabs, active_id)
}

#[tauri::command]
pub(crate) fn set_theme(theme: Theme, store: State<'_, MemoStore>) -> Result<(), String> {
    store.set_theme(theme)
}
