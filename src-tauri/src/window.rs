use tauri::{WebviewWindow, Window, WindowEvent};

pub(crate) fn enable_platform_frame_autosave(window: &WebviewWindow) {
    enable_macos_frame_autosave(window);
}

pub(crate) fn hide_window(window: &WebviewWindow) -> Result<(), String> {
    hide_platform_window(window);
    window.hide().map_err(|err| err.to_string())
}

#[cfg(not(target_os = "macos"))]
fn enable_macos_frame_autosave(_window: &WebviewWindow) {}

#[cfg(target_os = "macos")]
#[allow(unsafe_code)]
fn enable_macos_frame_autosave(window: &WebviewWindow) {
    use objc2_app_kit::{NSWindow, NSWindowFrameAutosaveName};
    use objc2_foundation::NSString;

    let Ok(ns_window) = window.ns_window() else {
        return;
    };
    let autosave_name = NSString::from_str("memo-main-window-frame");

    // Tauri's generic size APIs report unstable bounds with overlay titlebars on macOS.
    // Native NSWindow frame autosave preserves the exact user-facing frame instead.
    unsafe {
        let ns_window = &*ns_window.cast::<NSWindow>();
        let autosave_name: &NSWindowFrameAutosaveName = &autosave_name;
        let _ = ns_window.setFrameUsingName(autosave_name);
        let _ = ns_window.setFrameAutosaveName(autosave_name);
    }
}

pub(crate) fn handle_window_event(window: &Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        hide_platform_window(window);
        let _ = window.hide();
    }
}

#[cfg(not(target_os = "macos"))]
fn hide_platform_window<T>(_window: &T) {}

#[cfg(target_os = "macos")]
#[allow(unsafe_code)]
fn hide_platform_window<T>(window: &T)
where
    T: MacosWindowHandle,
{
    use objc2_app_kit::NSWindow;

    let Ok(ns_window) = window.ns_window() else {
        return;
    };
    unsafe {
        let ns_window = &*ns_window.cast::<NSWindow>();
        ns_window.orderOut(None);
    }
}

#[cfg(target_os = "macos")]
trait MacosWindowHandle {
    fn ns_window(&self) -> tauri::Result<*mut std::ffi::c_void>;
}

#[cfg(target_os = "macos")]
impl MacosWindowHandle for WebviewWindow {
    fn ns_window(&self) -> tauri::Result<*mut std::ffi::c_void> {
        WebviewWindow::ns_window(self)
    }
}

#[cfg(target_os = "macos")]
impl MacosWindowHandle for Window {
    fn ns_window(&self) -> tauri::Result<*mut std::ffi::c_void> {
        Window::ns_window(self)
    }
}
