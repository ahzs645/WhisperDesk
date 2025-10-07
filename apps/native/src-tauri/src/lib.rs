// Import command modules
mod commands;

#[cfg(target_os = "macos")]
mod screen_capture_kit;

use commands::*;
use commands::model_commands::ModelState;
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
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(SettingsState::new())
        .manage(ModelState::new())
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
            // Model commands
            load_model,
            list_models,
            get_models_folder,
            download_model,
            // Audio commands
            get_audio_devices,
            get_ffmpeg_path,
            start_record,
            // Transcription commands
            transcribe,
            stop_transcription,
            get_transcription_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
