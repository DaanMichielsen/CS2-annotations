use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

pub struct WatcherState(pub Mutex<Option<RecommendedWatcher>>);

impl Default for WatcherState {
    fn default() -> Self {
        WatcherState(Mutex::new(None))
    }
}

const DEBOUNCE: Duration = Duration::from_millis(400);

#[tauri::command]
pub fn watch_file(
    path: String,
    app: AppHandle,
    state: State<WatcherState>,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = None; // drop any existing watcher first, mirroring Electron's "one watcher at a time"

    let last_emit = Mutex::new(Instant::now() - DEBOUNCE);
    let emit_path = path.clone();
    let app_handle = app.clone();

    let mut watcher: RecommendedWatcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
        if res.is_err() {
            return;
        }
        let mut last = last_emit.lock().unwrap();
        if last.elapsed() < DEBOUNCE {
            return;
        }
        *last = Instant::now();
        let _ = app_handle.emit("guide-file-changed", emit_path.clone());
    })
    .map_err(|e| e.to_string())?;

    watcher
        .watch(std::path::Path::new(&path), RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    *guard = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn unwatch_file(state: State<WatcherState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}
