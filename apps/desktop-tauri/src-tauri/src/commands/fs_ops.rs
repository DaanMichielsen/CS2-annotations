use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
pub struct DirEntryInfo {
    pub name: String,
    pub is_dir: bool,
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_file(from: String, to: String) -> Result<(), String> {
    fs::copy(&from, &to).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_dir_if_empty(path: String) -> Result<(), String> {
    let dir = Path::new(&path);
    if dir.is_dir() && fs::read_dir(dir).map_err(|e| e.to_string())?.next().is_none() {
        fs::remove_dir(dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<DirEntryInfo>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        out.push(DirEntryInfo {
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: file_type.is_dir(),
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
pub fn stat_mtime_ms(path: String) -> Result<f64, String> {
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let modified = metadata.modified().map_err(|e| e.to_string())?;
    let duration = modified
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?;
    Ok(duration.as_millis() as f64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    /// Returns a unique temp subfolder path for this test run (not yet created on disk).
    fn unique_temp_dir(label: &str) -> String {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir()
            .join(format!("cs2ann-fs_ops-test-{}-{}", label, nanos))
            .to_string_lossy()
            .to_string()
    }

    #[test]
    fn round_trip_write_read_exists_delete() {
        let base = unique_temp_dir("roundtrip");
        let file_path = Path::new(&base).join("nested").join("file.txt");
        let file_path = file_path.to_string_lossy().to_string();

        // write_text_file should create missing parent directories.
        write_text_file(file_path.clone(), "hello".to_string()).expect("write should succeed");

        assert!(path_exists(file_path.clone()), "file should exist after write");

        let content = read_text_file(file_path.clone()).expect("read should succeed");
        assert_eq!(content, "hello");

        delete_file(file_path.clone()).expect("delete should succeed");
        assert!(!path_exists(file_path.clone()), "file should not exist after delete");

        // Clean up the base temp dir tree.
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn read_text_file_missing_returns_err() {
        let base = unique_temp_dir("missing-read");
        let missing = Path::new(&base).join("does-not-exist.txt");
        let missing = missing.to_string_lossy().to_string();

        let result = read_text_file(missing);
        assert!(result.is_err(), "reading a missing file should return Err");
    }

    #[test]
    fn delete_file_missing_returns_err() {
        let base = unique_temp_dir("missing-delete");
        let missing = Path::new(&base).join("does-not-exist.txt");
        let missing = missing.to_string_lossy().to_string();

        let result = delete_file(missing);
        assert!(result.is_err(), "deleting a missing file should return Err");
    }

    #[test]
    fn copy_file_round_trip() {
        let base = unique_temp_dir("copy");
        fs::create_dir_all(&base).expect("failed to create base temp dir");

        let src = Path::new(&base).join("src.txt").to_string_lossy().to_string();
        let dst = Path::new(&base).join("dst.txt").to_string_lossy().to_string();

        write_text_file(src.clone(), "copy me".to_string()).expect("write should succeed");
        copy_file(src.clone(), dst.clone()).expect("copy should succeed");

        let copied = read_text_file(dst.clone()).expect("read of copy should succeed");
        assert_eq!(copied, "copy me");

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn copy_file_missing_source_returns_err() {
        let base = unique_temp_dir("copy-missing");
        let src = Path::new(&base).join("nope.txt").to_string_lossy().to_string();
        let dst = Path::new(&base).join("dst.txt").to_string_lossy().to_string();

        let result = copy_file(src, dst);
        assert!(result.is_err(), "copying a missing source should return Err");
    }

    #[test]
    fn list_dir_returns_entries_with_correct_kind() {
        let base = unique_temp_dir("list");
        fs::create_dir_all(&base).expect("failed to create base temp dir");

        let file_path = Path::new(&base).join("a-file.txt").to_string_lossy().to_string();
        write_text_file(file_path, "x".to_string()).expect("write should succeed");

        let sub_dir = Path::new(&base).join("a-dir");
        fs::create_dir_all(&sub_dir).expect("failed to create sub dir");

        let entries = list_dir(base.clone()).expect("list_dir should succeed");
        assert_eq!(entries.len(), 2);

        let file_entry = entries
            .iter()
            .find(|e| e.name == "a-file.txt")
            .expect("expected a-file.txt entry");
        assert!(!file_entry.is_dir);

        let dir_entry = entries
            .iter()
            .find(|e| e.name == "a-dir")
            .expect("expected a-dir entry");
        assert!(dir_entry.is_dir);

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn list_dir_missing_returns_err() {
        let base = unique_temp_dir("list-missing");
        let result = list_dir(base);
        assert!(result.is_err(), "listing a missing dir should return Err");
    }

    #[test]
    fn delete_dir_if_empty_removes_only_when_empty() {
        let base = unique_temp_dir("delete-empty");
        fs::create_dir_all(&base).expect("failed to create base temp dir");

        // Non-empty: should not error and should not remove the dir.
        let file_path = Path::new(&base).join("keep.txt").to_string_lossy().to_string();
        write_text_file(file_path.clone(), "keep".to_string()).expect("write should succeed");

        delete_dir_if_empty(base.clone()).expect("should not error on non-empty dir");
        assert!(path_exists(base.clone()), "non-empty dir should still exist");

        // Now empty it and confirm removal.
        delete_file(file_path).expect("delete should succeed");
        delete_dir_if_empty(base.clone()).expect("should succeed on empty dir");
        assert!(!path_exists(base.clone()), "empty dir should have been removed");
    }

    #[test]
    fn path_exists_false_for_missing_path() {
        let base = unique_temp_dir("exists-missing");
        assert!(!path_exists(base));
    }

    #[test]
    fn stat_mtime_ms_returns_positive_mtime_for_existing_file() {
        let base = unique_temp_dir("mtime");
        fs::create_dir_all(&base).expect("failed to create base temp dir");
        let file_path = Path::new(&base).join("file.txt").to_string_lossy().to_string();
        write_text_file(file_path.clone(), "hello".to_string()).expect("write should succeed");

        let mtime = stat_mtime_ms(file_path).expect("stat should succeed for existing file");
        assert!(mtime > 0.0, "mtime should be a positive number of milliseconds since epoch");

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn stat_mtime_ms_missing_returns_err() {
        let base = unique_temp_dir("mtime-missing");
        let missing = Path::new(&base).join("does-not-exist.txt").to_string_lossy().to_string();

        let result = stat_mtime_ms(missing);
        assert!(result.is_err(), "stat of a missing path should return Err");
    }
}
