mod commands;
mod store;
mod window;

use tauri::Manager;

use store::MemoStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            app.manage(MemoStore::new(data_dir)?);
            if let Some(main_window) = app.get_webview_window("main") {
                main_window.set_title("")?;
                window::enable_platform_frame_autosave(&main_window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_memos,
            commands::create_memo,
            commands::read_memo,
            commands::save_memo,
            commands::delete_memo,
            commands::reorder_memos,
            commands::persist_tabs,
            commands::set_theme,
        ])
        .on_window_event(window::handle_window_event)
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| match event {
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } => {
                if let Some(window) = _app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        });
}
