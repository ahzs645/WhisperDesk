use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub version: String,
    pub name: String,
    pub platform: String,
}

/// Get application information
/// Maps to: app:getInfo from Electron
#[tauri::command]
pub async fn get_app_info() -> Result<AppInfo, String> {
    Ok(AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        name: "WhisperDesk".to_string(),
        platform: std::env::consts::OS.to_string(),
    })
}

/// Get platform-specific information
/// Maps to: app:getPlatform from Electron
#[tauri::command]
pub fn get_platform() -> String {
    #[cfg(target_os = "macos")]
    return "macOS".to_string();
    #[cfg(target_os = "windows")]
    return "Windows".to_string();
    #[cfg(target_os = "linux")]
    return "Linux".to_string();
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return "Unknown".to_string();
}

/// Quit the application
/// Maps to: app:quit from Electron
#[tauri::command]
pub async fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// Restart the application
/// Maps to: app:restart from Electron
#[tauri::command]
pub async fn restart_app(app: tauri::AppHandle) {
    app.restart();
}
