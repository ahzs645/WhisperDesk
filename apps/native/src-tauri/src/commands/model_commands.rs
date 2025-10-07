use eyre::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Listener, State};
use vibe_core::transcribe::WhisperContext;

/// State to hold the loaded Whisper model context
pub struct ModelState {
    pub context: Arc<Mutex<Option<WhisperContext>>>,
}

impl ModelState {
    pub fn new() -> Self {
        Self {
            context: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadModelOptions {
    pub model_path: String,
    pub gpu_device: Option<i32>,
    pub use_gpu: Option<bool>,
}

/// Load a Whisper model into memory
#[tauri::command]
pub async fn load_model(
    model_state: State<'_, ModelState>,
    options: LoadModelOptions,
) -> Result<String, String> {
    let model_path = PathBuf::from(&options.model_path);

    if !model_path.exists() {
        return Err(format!("Model file not found: {}", options.model_path));
    }

    let context = vibe_core::transcribe::create_context(
        &model_path,
        options.gpu_device,
        options.use_gpu,
    )
    .map_err(|e| format!("Failed to load model: {:?}", e))?;

    let mut state_guard = model_state
        .context
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    *state_guard = Some(context);

    Ok(format!("Model loaded successfully: {}", options.model_path))
}

/// List available models in a directory
#[tauri::command]
pub async fn list_models(models_dir: String) -> Result<Vec<String>, String> {
    let path = PathBuf::from(&models_dir);

    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut models = Vec::new();

    let entries = std::fs::read_dir(&path)
        .map_err(|e| format!("Failed to read models directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "bin" || ext == "gguf" {
                        if let Some(name) = path.file_name() {
                            if let Some(name_str) = name.to_str() {
                                models.push(name_str.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(models)
}

/// Get the default models directory
#[tauri::command]
pub async fn get_models_folder() -> Result<String, String> {
    // Get the app's data directory
    let data_dir = dirs::data_dir()
        .ok_or_else(|| "Failed to get data directory".to_string())?;

    let models_dir = data_dir.join("WhisperDesk").join("models");

    // Create the directory if it doesn't exist
    std::fs::create_dir_all(&models_dir)
        .map_err(|e| format!("Failed to create models directory: {}", e))?;

    models_dir
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to convert path to string".to_string())
}

/// Download a model from a URL
#[tauri::command]
pub async fn download_model(app_handle: AppHandle, url: String, path: String) -> Result<String, String> {
    let mut downloader = vibe_core::downloader::Downloader::new();
    tracing::debug!("Download model invoked! with path {}", path);

    let abort_atomic = Arc::new(AtomicBool::new(false));
    let abort_atomic_c = abort_atomic.clone();

    // Allow abort download
    app_handle.listen("abort_download", move |_| {
        abort_atomic_c.store(true, Ordering::Relaxed);
    });

    let download_progress_callback = {
        let app_handle = app_handle.clone();
        let abort_atomic = abort_atomic.clone();

        move |current: u64, total: u64| {
            let _ = app_handle.emit("download_progress", (current, total));
            !abort_atomic.load(Ordering::Relaxed)
        }
    };

    downloader
        .download(&url, PathBuf::from(&path), download_progress_callback)
        .await
        .map_err(|e| format!("Download failed: {:?}", e))?;

    Ok(path)
}
