use crate::{
    cli::{self, is_cli_detected},
    config::STORE_FILENAME,
    panic_hook,
    utils::{get_issue_url, LogError},
};
use eyre::eyre;
use once_cell::sync::Lazy;
use std::fs;
use tauri::{App, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_store::StoreExt;
use vibe_core::transcribe::WhisperContext;

pub static STATIC_APP: Lazy<std::sync::Mutex<Option<tauri::AppHandle>>> = Lazy::new(|| std::sync::Mutex::new(None));

pub struct ModelContext {
    pub path: String,
    pub gpu_device: Option<i32>,
    pub use_gpu: Option<bool>,
    pub handle: WhisperContext,
}

pub fn setup(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    // Add panic hook
    panic_hook::set_panic_hook(app.app_handle())?;

    // Create app directories
    let local_app_data_dir = app.path().app_local_data_dir()?;
    let app_config_dir = app.path().app_config_dir()?;
    fs::create_dir_all(&local_app_data_dir)
        .unwrap_or_else(|_| panic!("cant create local app data directory at {}", local_app_data_dir.display()));
    fs::create_dir_all(&app_config_dir)
        .unwrap_or_else(|_| panic!("cant create app config directory at {}", app_config_dir.display()));

    // Manage model context
    app.manage(tokio::sync::Mutex::new(None::<ModelContext>));

    let store = app.store(STORE_FILENAME)?;

    // Setup logging to terminal
    {
        let mut app_handle = STATIC_APP.lock().expect("lock");
        *app_handle = Some(app.handle().clone());
    }
    crate::logging::setup_logging(app.handle(), store).unwrap();
    crate::cleaner::clean_old_logs(app.handle()).log_error();
    crate::cleaner::clean_old_files().log_error();
    crate::cleaner::clean_updater_files().log_error();
    tracing::debug!("Vibe App Running");

    // Crash handler

    let _handler = crash_handler::CrashHandler::attach(unsafe {
        crash_handler::make_crash_event(move |cc: &crash_handler::CrashContext| {
            #[cfg(windows)]
            let info = cc.exception_code;

            #[cfg(windows)]
            tracing::error!("Crash exception code: {}", info);

            #[cfg(target_os = "macos")]
            let info = cc.exception;

            #[cfg(target_os = "linux")]
            let info = cc.siginfo;

            #[cfg(unix)]
            tracing::error!("Crash exception code: {:?}", info);

            if let Some(app_handle) = STATIC_APP.lock().expect("lock").as_ref() {
                app_handle
                    .dialog()
                    .message("App crashed with error. Please register to Github and then click report.")
                    .kind(tauri_plugin_dialog::MessageDialogKind::Error)
                    .title("Vibe Crashed")
                    .buttons(MessageDialogButtons::OkCustom("Report".into()))
                    .show(|_| {});
                let _ = app_handle.shell().open(get_issue_url(format!("{:?}", info)), None);
            }

            crash_handler::CrashEventResult::Handled(true)
        })
    });

    // Log some useful data
    if let Ok(version) = tauri::webview_version() {
        tracing::debug!("webview version: {}", version);
    }

    #[cfg(windows)]
    {
        if let Err(error) = crate::custom_protocol::register() {
            tracing::error!("{:?}", error);
        }
    }

    tracing::debug!("Cargo features: {}", crate::cmd::get_cargo_features().join(", "));

    #[cfg(all(any(target_arch = "x86", target_arch = "x86_64"), target_os = "windows"))]
    tracing::debug!(
        "CPU Features\n{}",
        crate::cmd::get_x86_features()
            .map(|v| serde_json::to_string(&v).unwrap_or_default())
            .unwrap_or_default()
    );

    #[cfg(not(all(any(target_arch = "x86", target_arch = "x86_64"), target_os = "windows")))]
    tracing::debug!("CPU feature detection is not supported on this architecture.");
    tracing::debug!("Executable Architecture: {}", std::env::consts::ARCH);

    tracing::debug!("APP VERSION: {}", app.package_info().version.to_string());
    tracing::debug!("COMMIT HASH: {}", env!("COMMIT_HASH"));
    tracing::debug!("App Info: {}", crate::utils::get_app_info());

    let app_handle = app.app_handle().clone();
    if is_cli_detected() {
        tracing::debug!("CLI mode");
        tauri::async_runtime::spawn(async move {
            cli::run(&app_handle).await.map_err(|e| eyre!("{:?}", e)).log_error();
        });
    } else {
        tracing::debug!("Non CLI mode");
        // Create main window programmatically with custom title bar settings
        let result = tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .max_inner_size(1920.0, 1080.0) // Set reasonable maximum size
            .center()
            .title("WhisperDesk")
            .resizable(true)
            .maximizable(true)
            .minimizable(true)
            .closable(true)
            .decorations(false)
            .focused(true)
            .visible(false) // Start hidden to prevent flicker
            .build();
        
        match result {
            Ok(window) => {
                tracing::debug!("Successfully created main window");
                // Force remove decorations after window creation
                if let Err(e) = window.set_decorations(false) {
                    tracing::error!("Failed to remove decorations: {:?}", e);
                } else {
                    tracing::debug!("Successfully removed window decorations");
                }
                
                // Show window after setup is complete
                if let Err(e) = window.show() {
                    tracing::error!("Failed to show window: {:?}", e);
                } else {
                    tracing::debug!("Window shown successfully");
                }
                
                // Focus the window
                if let Err(e) = window.set_focus() {
                    tracing::error!("Failed to focus window: {:?}", e);
                }
            }
            Err(error) => tracing::error!("Failed to create main window: {:?}", error),
        }
    }
    Ok(())
}
