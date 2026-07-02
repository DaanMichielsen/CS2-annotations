use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct CfgWriteResult {
    #[serde(rename = "cfgPath")]
    cfg_path: String,
    content: String,
}

#[tauri::command]
pub fn write_cs2_cfg(annotations_root: String, command: String) -> Result<CfgWriteResult, String> {
    if annotations_root.is_empty() {
        return Err("Annotations folder not configured in Settings.".into());
    }
    // Mirrors Electron: path.resolve(path.join(annotationsRoot, '../../cfg'))
    let mut cfg_dir = PathBuf::from(&annotations_root);
    cfg_dir.pop(); // .../annotations
    cfg_dir.pop(); // .../csgo
    cfg_dir.push("cfg");

    if !cfg_dir.exists() {
        return Err(format!("CS2 cfg folder not found at: {}", cfg_dir.display()));
    }

    let cfg_file = cfg_dir.join("annotation_manager.cfg");
    fs::write(&cfg_file, format!("{}\n", command)).map_err(|e| e.to_string())?;

    Ok(CfgWriteResult {
        cfg_path: cfg_file.to_string_lossy().to_string(),
        content: command,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs as stdfs;

    /// Builds a temp dir tree `<tmp>/game/csgo/annotations/local` plus
    /// `<tmp>/game/csgo/cfg`, mirroring the real Steam layout, and returns
    /// the annotations root path.
    fn setup_tree() -> (tempfile_dir::TempDir, PathBuf) {
        let tmp = tempfile_dir::TempDir::new();
        let annotations_root = tmp.path().join("game").join("csgo").join("annotations").join("local");
        stdfs::create_dir_all(&annotations_root).unwrap();
        let cfg_dir = tmp.path().join("game").join("csgo").join("cfg");
        stdfs::create_dir_all(&cfg_dir).unwrap();
        (tmp, annotations_root)
    }

    #[test]
    fn writes_the_command_to_the_cfg_file() {
        let (_tmp, annotations_root) = setup_tree();
        let result = write_cs2_cfg(annotations_root.to_string_lossy().to_string(), "sv_cheats 1".into());
        let result = result.expect("expected Ok");
        assert!(result.cfg_path.ends_with("annotation_manager.cfg"));
        let written = stdfs::read_to_string(&result.cfg_path).unwrap();
        assert_eq!(written, "sv_cheats 1\n");
    }

    #[test]
    fn errors_on_empty_annotations_root() {
        let result = write_cs2_cfg(String::new(), "sv_cheats 1".into());
        assert!(result.is_err());
    }

    #[test]
    fn errors_when_cfg_dir_does_not_exist() {
        let tmp = tempfile_dir::TempDir::new();
        // Only create the annotations dir, not ../../cfg
        let annotations_root = tmp.path().join("game").join("csgo").join("annotations").join("local");
        stdfs::create_dir_all(&annotations_root).unwrap();
        let result = write_cs2_cfg(annotations_root.to_string_lossy().to_string(), "sv_cheats 1".into());
        assert!(result.is_err());
    }
}

#[cfg(test)]
mod tempfile_dir {
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    /// Minimal self-cleaning temp-directory helper so tests don't need an
    /// external `tempfile` dependency. Each instance gets a unique path
    /// under `std::env::temp_dir()` and the directory (recursively) is
    /// removed when the guard is dropped.
    pub struct TempDir {
        path: PathBuf,
    }

    impl TempDir {
        pub fn new() -> Self {
            let nanos = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let n = COUNTER.fetch_add(1, Ordering::SeqCst);
            let path = std::env::temp_dir().join(format!("cs2ann-cs2-test-{}-{}", nanos, n));
            std::fs::create_dir_all(&path).unwrap();
            TempDir { path }
        }

        pub fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.path);
        }
    }
}
