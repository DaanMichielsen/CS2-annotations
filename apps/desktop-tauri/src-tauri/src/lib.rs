mod commands;

use commands::cs2::write_cs2_cfg;
use commands::fs_ops::{copy_file, delete_dir_if_empty, delete_file, list_dir, path_exists, read_text_file, write_text_file};
use commands::steam::detect_steam_path;
use commands::watcher::{unwatch_file, watch_file, WatcherState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .manage(WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            copy_file,
            delete_file,
            delete_dir_if_empty,
            list_dir,
            path_exists,
            detect_steam_path,
            watch_file,
            unwatch_file,
            write_cs2_cfg,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
