// Import command modules
mod commands;

use commands::*;
use commands::settings_commands::SettingsState;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(SettingsState::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            // App commands
            get_app_info,
            get_platform,
            quit_app,
            restart_app,
            // Settings commands
            get_setting,
            set_setting,
            get_all_settings,
            delete_setting,
            reset_settings,
            // Transcription commands
            start_transcription,
            stop_transcription,
            get_transcription_status,
            list_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
