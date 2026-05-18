use tauri::{Manager, PhysicalPosition, PhysicalSize, WebviewWindow, Window, WindowEvent};

use crate::store::MemoStore;

pub(crate) fn restore_window_state(window: &WebviewWindow, store: &MemoStore) {
    let Some(window_state) = store.window_state() else {
        return;
    };
    let _ = window.set_size(PhysicalSize::new(window_state.width, window_state.height));
    let _ = window.set_position(PhysicalPosition::new(window_state.x, window_state.y));
}

pub(crate) fn flush_cached_window_state(store: &MemoStore) -> Result<(), String> {
    store.flush_window_state()
}

pub(crate) fn handle_window_event(window: &Window, event: &WindowEvent) {
    let Some(store) = window.try_state::<MemoStore>() else {
        return;
    };
    match event {
        WindowEvent::Moved(position) => {
            let _ = store.cache_window_position(position.x, position.y);
        }
        WindowEvent::Resized(size) => {
            let _ = store.cache_window_size(size.width, size.height);
        }
        WindowEvent::CloseRequested { api, .. } => {
            let _ = store.flush_window_state();
            api.prevent_close();
            let _ = window.hide();
        }
        _ => {}
    }
}
