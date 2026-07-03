mod commands;

use commands::cs2::write_cs2_cfg;
use commands::fs_ops::{copy_file, delete_dir_if_empty, delete_file, list_dir, path_exists, read_text_file, stat_mtime_ms, write_text_file};
use commands::steam::detect_steam_path;
use commands::watcher::{unwatch_file, watch_file, WatcherState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must stay the first plugin registered: on Windows/Linux a second
        // launch (e.g. from a deep link) spawns a brand-new process whose
        // whole job is to hand its argv to this one and exit. Registering
        // single-instance first ensures it can intercept that before any
        // other plugin (webview creation, etc.) reacts to the second launch.
        //
        // With the `deep-link` Cargo feature enabled on
        // tauri-plugin-single-instance, `Builder::callback` wraps our
        // closure below and — before invoking it — looks up the deep-link
        // plugin's managed `DeepLink<R>` state and calls
        // `handle_cli_arguments(argv)` on it. That's what makes the
        // deep-link plugin re-parse the forwarded argv and emit
        // `deep-link://new-url`, which the frontend's `onOpenUrl` listener
        // (see src/lib/authBridge.ts) is subscribed to. So on a warm start
        // we don't need to touch `_argv` ourselves here — the feature does
        // the forwarding as long as the deep-link plugin below is also
        // registered (state lookup happens at callback time, not at
        // registration time, so registration order between the two plugins
        // doesn't matter — only single-instance being first overall does).
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
            stat_mtime_ms,
            detect_steam_path,
            watch_file,
            unwatch_file,
            write_cs2_cfg,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
