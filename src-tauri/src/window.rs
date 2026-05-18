use tauri::{Manager, PhysicalPosition, PhysicalSize, WebviewWindow, Window, WindowEvent};

use crate::store::{MemoStore, WindowState};

pub(crate) fn restore_window_state(window: &WebviewWindow, store: &MemoStore) {
    let Some(window_state) = store.window_state() else {
        return;
    };
    let _ = window.set_size(PhysicalSize::new(window_state.width, window_state.height));
    let _ = window.set_position(PhysicalPosition::new(window_state.x, window_state.y));
}

pub(crate) fn save_window_state(window: &Window, store: &MemoStore) -> Result<(), String> {
    if window.is_fullscreen().map_err(to_message)? || window.is_minimized().map_err(to_message)? {
        return Ok(());
    }

    let position = window.outer_position().map_err(to_message)?;
    let size = window.outer_size().map_err(to_message)?;
    store.set_window_state(window_state_from_parts(position, size))
}

pub(crate) fn save_webview_window_state(
    window: &WebviewWindow,
    store: &MemoStore,
) -> Result<(), String> {
    if window.is_fullscreen().map_err(to_message)? || window.is_minimized().map_err(to_message)? {
        return Ok(());
    }

    let position = window.outer_position().map_err(to_message)?;
    let size = window.outer_size().map_err(to_message)?;
    store.set_window_state(window_state_from_parts(position, size))
}

pub(crate) fn handle_window_event(window: &Window, event: &WindowEvent) {
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

fn to_message(err: impl ToString) -> String {
    err.to_string()
}
