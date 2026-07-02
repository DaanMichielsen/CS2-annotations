use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

const DEBOUNCE: Duration = Duration::from_millis(400);

/// Holds a `notify` watcher alongside the `Sender` that feeds its trailing-edge
/// debouncer thread. Both fields are dropped together when the `Option` is
/// replaced or cleared:
///
/// - Dropping `_debounce_tx` closes the debouncer's channel. The debouncer
///   thread is blocked in `recv_timeout`, which then returns
///   `Err(Disconnected)` and the thread exits (see `spawn_debouncer`). No
///   thread is left running after the watcher is torn down.
/// - Dropping `_watcher` stops the underlying OS file watch (`notify`'s
///   `Drop` impl unregisters it).
///
/// Field order doesn't matter for this guarantee (Rust drops struct fields in
/// declaration order, but both need to go away and both do, regardless of
/// order), it's the fact that both are owned here — and not leaked into any
/// detached/static context — that ensures `watch_file` replacing the old
/// watcher, or `unwatch_file` clearing it, fully tears down the previous
/// debouncer thread with no spurious late emissions.
pub(crate) struct ActiveWatcher {
    _watcher: RecommendedWatcher,
    _debounce_tx: Sender<()>,
}

pub struct WatcherState(pub Mutex<Option<ActiveWatcher>>);

impl Default for WatcherState {
    fn default() -> Self {
        WatcherState(Mutex::new(None))
    }
}

/// Spawns a thread implementing trailing-edge debounce: each call to
/// `tx.send(())` marks an event as pending. If no further event arrives
/// within `debounce`, `on_fire` is invoked exactly once and the pending flag
/// is cleared. A fresh event arriving before the timeout simply resets the
/// wait — matching the semantics of Electron's `setTimeout` + `clearTimeout`
/// debounce (`apps/desktop/electron/main/index.ts:4-7`).
///
/// The thread exits cleanly (without firing) once every `Sender` clone is
/// dropped and `recv_timeout` reports `Disconnected`.
fn spawn_debouncer(
    debounce: Duration,
    on_fire: impl Fn() + Send + 'static,
) -> Sender<()> {
    let (tx, rx) = mpsc::channel::<()>();

    std::thread::spawn(move || {
        let mut pending = false;
        loop {
            match rx.recv_timeout(debounce) {
                Ok(()) => {
                    pending = true;
                }
                Err(RecvTimeoutError::Timeout) => {
                    if pending {
                        on_fire();
                        pending = false;
                    }
                }
                Err(RecvTimeoutError::Disconnected) => {
                    break;
                }
            }
        }
    });

    tx
}

#[tauri::command]
pub fn watch_file(
    path: String,
    app: AppHandle,
    state: State<WatcherState>,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = None; // drop any existing watcher (and its debouncer) first, mirroring Electron's "one watcher at a time"

    let emit_path = path.clone();
    let app_handle = app.clone();

    let debounce_tx = spawn_debouncer(DEBOUNCE, move || {
        let _ = app_handle.emit("guide-file-changed", emit_path.clone());
    });

    let watcher_tx = debounce_tx.clone();
    let mut watcher: RecommendedWatcher =
        notify::recommended_watcher(move |res: notify::Result<Event>| {
            if res.is_err() {
                return;
            }
            let _ = watcher_tx.send(());
        })
        .map_err(|e| e.to_string())?;

    watcher
        .watch(std::path::Path::new(&path), RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    *guard = Some(ActiveWatcher {
        _watcher: watcher,
        _debounce_tx: debounce_tx,
    });
    Ok(())
}

#[tauri::command]
pub fn unwatch_file(state: State<WatcherState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use std::thread::sleep;

    const TEST_DEBOUNCE: Duration = Duration::from_millis(100);

    #[test]
    fn burst_of_sends_yields_exactly_one_fire_after_the_last_send() {
        let counter = Arc::new(AtomicUsize::new(0));
        let counter_clone = Arc::clone(&counter);
        let tx = spawn_debouncer(TEST_DEBOUNCE, move || {
            counter_clone.fetch_add(1, Ordering::SeqCst);
        });

        // 5 sends spaced ~50ms apart, well under the 100ms debounce window,
        // so each one should reset the timer instead of firing.
        for _ in 0..5 {
            tx.send(()).unwrap();
            sleep(Duration::from_millis(50));
        }

        // Immediately after the last send, no fire should have happened yet
        // (this is what distinguishes trailing-edge from leading-edge).
        assert_eq!(counter.load(Ordering::SeqCst), 0);

        // Wait well past the debounce window (100ms) for the trailing fire.
        sleep(Duration::from_millis(600));
        assert_eq!(counter.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn two_bursts_separated_by_quiet_yield_two_fires() {
        let counter = Arc::new(AtomicUsize::new(0));
        let counter_clone = Arc::clone(&counter);
        let tx = spawn_debouncer(TEST_DEBOUNCE, move || {
            counter_clone.fetch_add(1, Ordering::SeqCst);
        });

        tx.send(()).unwrap();
        sleep(Duration::from_millis(600)); // let it fire (1)
        assert_eq!(counter.load(Ordering::SeqCst), 1);

        tx.send(()).unwrap();
        sleep(Duration::from_millis(600)); // let it fire again (2)
        assert_eq!(counter.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn dropping_sender_stops_thread_without_spurious_fire() {
        let counter = Arc::new(AtomicUsize::new(0));
        let counter_clone = Arc::clone(&counter);
        let tx = spawn_debouncer(TEST_DEBOUNCE, move || {
            counter_clone.fetch_add(1, Ordering::SeqCst);
        });

        tx.send(()).unwrap();
        drop(tx); // disconnect before the debounce window elapses

        sleep(Duration::from_millis(600));
        // The thread should have exited on Disconnected without ever firing.
        assert_eq!(counter.load(Ordering::SeqCst), 0);
    }
}
