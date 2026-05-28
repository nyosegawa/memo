use std::{path::Path, process::Command};

use tauri::{AppHandle, Manager, State};

use crate::store::{AppSnapshot, MemoDocument, MemoStore, MemoSummary, Theme};
use crate::window;

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

#[tauri::command]
pub(crate) fn memo_path(id: String, store: State<'_, MemoStore>) -> Result<String, String> {
    Ok(store.memo_file_path(&id)?.to_string_lossy().into_owned())
}

#[tauri::command]
pub(crate) fn reveal_memo_in_file_manager(
    id: String,
    store: State<'_, MemoStore>,
) -> Result<(), String> {
    let path = store.memo_file_path(&id)?;
    reveal_in_file_manager(&path)
}

#[tauri::command]
pub(crate) fn hide_main_window(app: AppHandle) -> Result<(), String> {
    let Some(main_window) = app.get_webview_window("main") else {
        return Ok(());
    };
    window::hide_window(&main_window)
}

fn reveal_in_file_manager(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let status = Command::new("open")
        .arg("-R")
        .arg(path)
        .status()
        .map_err(|err| err.to_string())?;

    #[cfg(target_os = "windows")]
    let status = Command::new("explorer")
        .arg(format!("/select,{}", path.display()))
        .status()
        .map_err(|err| err.to_string())?;

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let status = Command::new("xdg-open")
        .arg(path.parent().unwrap_or(path))
        .status()
        .map_err(|err| err.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err("failed to reveal memo in file manager".to_string())
    }
}
