use serde::Serialize;

const CS2_ANNOTATIONS_RELATIVE: &str =
    r"steamapps\common\Counter-Strike Global Offensive\game\csgo\annotations\local";
const CS2_WORKSHOP_CONTENT_RELATIVE: &str = r"steamapps\workshop\content\730";

fn derive_annotations_root(steam_path: &str) -> String {
    format!("{}\\{}", steam_path.trim_end_matches('\\'), CS2_ANNOTATIONS_RELATIVE)
}

fn derive_workshop_content_path(steam_path: &str) -> String {
    format!("{}\\{}", steam_path.trim_end_matches('\\'), CS2_WORKSHOP_CONTENT_RELATIVE)
}

#[cfg(windows)]
fn read_steam_path_from_registry() -> Option<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey(r"Software\Valve\Steam") {
        if let Ok(path) = key.get_value::<String, _>("SteamPath") {
            return Some(path);
        }
    }

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(key) = hklm.open_subkey(r"SOFTWARE\WOW6432Node\Valve\Steam") {
        if let Ok(path) = key.get_value::<String, _>("InstallPath") {
            return Some(path);
        }
    }

    None
}

#[cfg(not(windows))]
fn read_steam_path_from_registry() -> Option<String> {
    None
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum DetectSteamPathResult {
    Ok {
        path: String,
        #[serde(rename = "annotationsRoot")]
        annotations_root: String,
        #[serde(rename = "workshopContentPath")]
        workshop_content_path: String,
    },
    Err {
        error: String,
    },
}

#[tauri::command]
pub fn detect_steam_path() -> DetectSteamPathResult {
    let steam_path = match read_steam_path_from_registry() {
        Some(p) => p,
        None => {
            let fallback = r"C:\Program Files (x86)\Steam";
            if std::path::Path::new(fallback).exists() {
                fallback.to_string()
            } else {
                return DetectSteamPathResult::Err {
                    error: "Steam path not found in registry. Set the folders manually.".into(),
                };
            }
        }
    };

    DetectSteamPathResult::Ok {
        annotations_root: derive_annotations_root(&steam_path),
        workshop_content_path: derive_workshop_content_path(&steam_path),
        path: steam_path,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_annotations_root_from_steam_path() {
        let result = derive_annotations_root(r"C:\Program Files (x86)\Steam");
        assert_eq!(
            result,
            r"C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\annotations\local"
        );
    }

    #[test]
    fn derives_workshop_content_path_from_steam_path() {
        let result = derive_workshop_content_path(r"C:\Program Files (x86)\Steam");
        assert_eq!(
            result,
            r"C:\Program Files (x86)\Steam\steamapps\workshop\content\730"
        );
    }

    #[test]
    fn strips_trailing_backslash_before_joining() {
        let result = derive_annotations_root(r"C:\Steam\");
        assert!(!result.contains(r"Steam\\steamapps"));
    }
}
