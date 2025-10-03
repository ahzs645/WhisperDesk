// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cleaner;
mod cli;
mod cmd;
mod config;
mod panic_hook;
mod whisperdesk_cmd;

#[cfg(feature = "server")]
mod server;

mod setup;
mod utils;
use tauri::{Emitter, Manager};
mod logging;

#[cfg(target_os = "macos")]
mod dock;

#[cfg(all(any(target_arch = "x86", target_arch = "x86_64"), target_os = "windows"))]
mod x86_features;

#[cfg(windows)]
mod custom_protocol;

#[cfg(windows)]
mod gpu_preference;

#[cfg(target_os = "macos")]
mod screen_capture_kit;

use eyre::{eyre, Result};
use tauri_plugin_window_state::StateFlags;

use utils::LogError;

fn main() -> Result<()> {
    // Attach console in Windows:
    #[cfg(all(windows, not(debug_assertions)))]
    cli::attach_console();

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            tracing::debug!("{}, {argv:?}, {cwd}", app.package_info().name);
            if let Some(webview) = app.get_webview_window("main") {
                webview.set_focus().map_err(|e| eyre!("{:?}", e)).log_error();
            }
            app.emit("single-instance", argv).map_err(|e| eyre!("{:?}", e)).log_error();
        }))
        .setup(|app| setup::setup(app))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(!StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_keepawake::init())
        .invoke_handler(tauri::generate_handler![
            // cmd::download_file,   // Temporarily disabled - eyre::Result not compatible
            cmd::get_cargo_features,
            // cmd::transcribe,      // Temporarily disabled - eyre::Result not compatible  
            cmd::glob_files,
            // cmd::download_model,  // Temporarily disabled - eyre::Result not compatible
            // cmd::load_model,      // Temporarily disabled - eyre::Result not compatible
            cmd::get_commit_hash,
            cmd::get_cuda_version,
            cmd::get_rocm_version,
            cmd::is_avx2_enabled,
            // cmd::is_online,       // Temporarily disabled - eyre::Result not compatible
            // cmd::get_path_dst,        // Temporarily disabled - eyre::Result not compatible
            // cmd::get_logs,            // Temporarily disabled - eyre::Result not compatible
            // cmd::open_path,           // Temporarily disabled - eyre::Result not compatible
            cmd::get_x86_features,
            // cmd::get_save_path,       // Temporarily disabled - eyre::Result not compatible
            cmd::get_argv,
            // cmd::audio::get_audio_devices,  // Temporarily disabled - eyre::Result not compatible
            // cmd::audio::start_record,  // Temporarily disabled - eyre::Result not compatible
            // cmd::get_models_folder,   // Temporarily disabled - eyre::Result not compatible
            cmd::is_portable,
            // cmd::check_vulkan,        // Temporarily disabled - eyre::Result not compatible
            // cmd::get_logs_folder,     // Temporarily disabled - eyre::Result not compatible
            // cmd::show_log_path,   // Temporarily disabled - eyre::Result not compatible
            // cmd::show_temp_path,  // Temporarily disabled - eyre::Result not compatible
            cmd::get_ffmpeg_path,
            // cmd::ytdlp::download_audio,  // Temporarily disabled - eyre::Result not compatible
            cmd::ytdlp::get_temp_path,
            cmd::is_crashed_recently,
            // cmd::rename_crash_file,      // Temporarily disabled - eyre::Result not compatible
            #[cfg(windows)]
            cmd::set_high_gpu_preference,
            // WhisperDesk-specific commands
            whisperdesk_cmd::transcribe_audio,
            whisperdesk_cmd::process_diarization,
            whisperdesk_cmd::analyze_sentiment,
            whisperdesk_cmd::extract_topics,
            whisperdesk_cmd::export_transcript,
            whisperdesk_cmd::get_recording_status,
            whisperdesk_cmd::get_screens,
            whisperdesk_cmd::start_screen_recording,
            whisperdesk_cmd::stop_screen_recording,
            whisperdesk_cmd::load_whisper_model,
            whisperdesk_cmd::get_available_models
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    Ok(())
}
