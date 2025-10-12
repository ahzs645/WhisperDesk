use eyre::Result;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{Emitter, Listener, Manager, State};
use vibe_core::config::TranscribeOptions;
use vibe_core::transcript::Segment;

use super::model_commands::ModelState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionRequest {
    pub audio_path: String,
    pub language: Option<String>,
    pub translate: Option<bool>,
    pub word_timestamps: Option<bool>,
    pub max_sentence_len: Option<i32>,
    pub enable_diarization: Option<bool>,
    pub max_speakers: Option<usize>,
    pub diarization_threshold: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionSegment {
    pub start: i64,
    pub stop: i64,
    pub text: String,
    pub speaker: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub segments: Vec<TranscriptionSegment>,
    pub processing_time_sec: u64,
}

impl From<Segment> for TranscriptionSegment {
    fn from(segment: Segment) -> Self {
        Self {
            start: segment.start,
            stop: segment.stop,
            text: segment.text,
            speaker: segment.speaker,
        }
    }
}

/// Transcribe audio file
#[tauri::command]
pub async fn transcribe(
    app_handle: tauri::AppHandle,
    model_state: State<'_, ModelState>,
    request: TranscriptionRequest,
) -> Result<TranscriptionResult, String> {
    tracing::info!("Transcription request received: {:?}", request);

    // Get the model context
    let context_guard = model_state
        .context
        .lock()
        .map_err(|e| {
            tracing::error!("Failed to acquire model lock: {}", e);
            format!("Failed to acquire model lock: {}", e)
        })?;

    let context = context_guard
        .as_ref()
        .ok_or_else(|| {
            tracing::error!("No model loaded");
            "No model loaded. Please load a model first.".to_string()
        })?;

    tracing::info!("Model context acquired successfully");

    // Prepare transcription options
    let options = TranscribeOptions {
        path: request.audio_path.clone(),
        lang: request.language.clone(),
        translate: request.translate,
        word_timestamps: request.word_timestamps,
        max_sentence_len: request.max_sentence_len,
        n_threads: Some(4),
        temperature: None,
        init_prompt: None,
        max_text_ctx: None,
        sampling_bestof_or_beam_size: None,
        sampling_strategy: None,
        verbose: Some(false),
    };

    // Create abort flag
    let abort_flag = Arc::new(AtomicBool::new(false));
    let abort_flag_clone = abort_flag.clone();

    // Listen for abort event
    let app_handle_abort = app_handle.clone();
    app_handle.listen("abort_transcription", move |_event| {
        tracing::info!("Abort transcription requested");
        abort_flag_clone.store(true, Ordering::Relaxed);
    });

    // Progress callback
    let app_handle_progress = app_handle.clone();
    let progress_callback = Box::new(move |progress: i32| {
        if let Some(window) = app_handle_progress.get_webview_window("main") {
            let _ = window.emit("transcription_progress", progress);
        }
    });

    // New segment callback
    let app_handle_segment = app_handle.clone();
    let new_segment_callback = Box::new(move |segment: Segment| {
        if let Some(window) = app_handle_segment.get_webview_window("main") {
            let segment: TranscriptionSegment = segment.into();
            let _ = window.emit("transcription_segment", segment);
        }
    });

    // Abort callback
    let abort_callback = Box::new(move || abort_flag.load(Ordering::Relaxed));

    // Setup diarization if enabled
    let diarize_options = if request.enable_diarization.unwrap_or(false) {
        tracing::info!("Diarization enabled, checking for models...");
        // Get models folder
        let models_dir = dirs::data_dir()
            .ok_or_else(|| {
                tracing::error!("Failed to get data directory");
                "Failed to get data directory".to_string()
            })?
            .join("WhisperDesk")
            .join("models");

        tracing::info!("Models directory: {:?}", models_dir);

        let segment_model_path = models_dir.join("segmentation-3.0.onnx");
        let embedding_model_path = models_dir.join("wespeaker_en_voxceleb_CAM++.onnx");

        // Check if models exist
        if !segment_model_path.exists() {
            tracing::error!("Segmentation model not found at: {:?}", segment_model_path);
            return Err(format!(
                "Diarization segmentation model not found at: {}. Please download it first.",
                segment_model_path.display()
            ));
        }
        if !embedding_model_path.exists() {
            tracing::error!("Embedding model not found at: {:?}", embedding_model_path);
            return Err(format!(
                "Diarization embedding model not found at: {}. Please download it first.",
                embedding_model_path.display()
            ));
        }

        tracing::info!("Diarization models found, setting up options");

        Some(vibe_core::transcribe::DiarizeOptions {
            segment_model_path: segment_model_path.to_string_lossy().to_string(),
            embedding_model_path: embedding_model_path.to_string_lossy().to_string(),
            threshold: request.diarization_threshold.unwrap_or(0.5),
            max_speakers: request.max_speakers.unwrap_or(10),
        })
    } else {
        tracing::info!("Diarization disabled");
        None
    };

    // Run transcription
    let transcript = vibe_core::transcribe::transcribe(
        context,
        &options,
        Some(progress_callback),
        Some(new_segment_callback),
        Some(abort_callback),
        diarize_options,
        None, // No additional ffmpeg args
    )
    .map_err(|e| format!("Transcription failed: {:?}", e))?;

    // Convert to result format
    let result = TranscriptionResult {
        segments: transcript
            .segments
            .into_iter()
            .map(|s| s.into())
            .collect(),
        processing_time_sec: transcript.processing_time_sec,
    };

    Ok(result)
}

/// Get transcription status
#[tauri::command]
pub async fn get_transcription_status() -> Result<String, String> {
    // TODO: Track actual transcription state
    Ok("idle".to_string())
}

/// Stop ongoing transcription
#[tauri::command]
pub async fn stop_transcription(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Emit abort event
    app_handle
        .emit("abort_transcription", ())
        .map_err(|e| format!("Failed to emit abort event: {}", e))?;

    Ok(())
}
