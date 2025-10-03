use serde::{Deserialize, Serialize};
use vibe_core::config::TranscribeOptions;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub segments: Vec<TranscriptSegment>,
    pub language: Option<String>,
    pub duration: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub start: f32,
    pub end: f32,
    pub text: String,
    pub speaker: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiarizationResult {
    pub speakers: Vec<Speaker>,
    pub segments: Vec<DiarizedSegment>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Speaker {
    pub id: String,
    pub name: Option<String>,
    pub total_duration: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiarizedSegment {
    pub start: f32,
    pub end: f32,
    pub speaker_id: String,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalyticsResult {
    pub sentiment: SentimentAnalysis,
    pub topics: Vec<String>,
    pub speech_patterns: SpeechPatterns,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SentimentAnalysis {
    pub overall: f32,
    pub positive: f32,
    pub negative: f32,
    pub neutral: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpeechPatterns {
    pub pace: f32,
    pub filler_words: Vec<String>,
    pub repetitions: Vec<String>,
}

// Enhanced transcription with WhisperDesk features
#[tauri::command]
pub async fn transcribe_audio(
    app_handle: tauri::AppHandle,
    path: String,
    options: Option<TranscribeOptions>,
) -> Result<TranscriptionResult, String> {
    tracing::debug!("🎵 Transcribing audio file: {}", path);
    
    // Check if file exists
    let file_path = std::path::PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("Audio file does not exist: {}", path));
    }
    
    // Create transcribe options with proper defaults
    let opts = options.unwrap_or(TranscribeOptions {
        path: path.clone(),
        lang: None,
        verbose: Some(false),
        n_threads: Some(4), // Default to 4 threads
        init_prompt: None,
        temperature: Some(0.0), // Default temperature
        translate: Some(false),
        max_text_ctx: Some(224),
        word_timestamps: Some(true), // Enable word timestamps
        max_sentence_len: Some(1000),
        sampling_strategy: None,
        sampling_bestof_or_beam_size: Some(5),
    });
    
    // Get the loaded model from app state
    let model_state = app_handle.state::<tokio::sync::Mutex<Option<crate::setup::ModelContext>>>();
    let guard = model_state.lock().await;
    
    if let Some(_model_context) = guard.as_ref() {
        tracing::debug!("🚀 Model is loaded - real transcription will be implemented");
        
        // TODO: Implement real transcription with proper lifetime handling
        // For now, return enhanced mock data to show integration is working
        drop(guard);
        
        let segments = vec![
            TranscriptSegment {
                start: 0.0,
                end: 2.5,
                text: "Real model is loaded and ready for transcription.".to_string(),
                speaker: Some("Speaker 1".to_string()),
            },
            TranscriptSegment {
                start: 2.5,
                end: 5.0,
                text: "WhisperDesk Tauri integration with vibe-core is working.".to_string(),
                speaker: Some("Speaker 1".to_string()),
            },
        ];
        
        let text = segments.iter().map(|s| s.text.as_str()).collect::<Vec<_>>().join(" ");
        let duration = segments.iter()
            .map(|s| s.end)
            .fold(0.0f32, |acc, end| acc.max(end));
        
        Ok(TranscriptionResult {
            text,
            segments,
            language: Some("en".to_string()),
            duration,
        })
    } else {
        tracing::warn!("⚠️ No model loaded, using mock data");
        
        // Return mock segments if no model is loaded
        let segments = vec![
            TranscriptSegment {
                start: 0.0,
                end: 2.5,
                text: "No model loaded - this is mock transcription data.".to_string(),
                speaker: Some("Speaker 1".to_string()),
            },
            TranscriptSegment {
                start: 2.5,
                end: 5.0,
                text: "Please load a Whisper model first to get real transcriptions.".to_string(),
                speaker: Some("Speaker 1".to_string()),
            },
        ];
        
        let text = segments.iter().map(|s| s.text.as_str()).collect::<Vec<_>>().join(" ");
        let duration = segments.iter()
            .map(|s| s.end)
            .fold(0.0f32, |acc, end| acc.max(end));
        
        Ok(TranscriptionResult {
            text,
            segments,
            language: Some("en".to_string()),
            duration,
        })
    }
}

// Speaker diarization
#[tauri::command]
pub async fn process_diarization(
    _audio_path: String,
    transcript: TranscriptionResult,
) -> Result<DiarizationResult, String> {
    // Use pyannote-rs from vibe_core for diarization
    // This is a placeholder - actual implementation would use pyannote-rs
    
    // For now, return mock data
    Ok(DiarizationResult {
        speakers: vec![
            Speaker {
                id: "SPEAKER_00".to_string(),
                name: Some("Speaker 1".to_string()),
                total_duration: 45.0,
            },
            Speaker {
                id: "SPEAKER_01".to_string(),
                name: Some("Speaker 2".to_string()),
                total_duration: 30.0,
            },
        ],
        segments: transcript.segments.into_iter().enumerate().map(|(i, s)| DiarizedSegment {
            start: s.start,
            end: s.end,
            speaker_id: if i % 2 == 0 { "SPEAKER_00" } else { "SPEAKER_01" }.to_string(),
            text: s.text,
        }).collect(),
    })
}

// Analytics processing
#[tauri::command]
pub async fn analyze_sentiment(_text: String) -> Result<AnalyticsResult, String> {
    // Placeholder for sentiment analysis
    // In production, this would use an NLP library or service
    
    Ok(AnalyticsResult {
        sentiment: SentimentAnalysis {
            overall: 0.65,
            positive: 0.65,
            negative: 0.15,
            neutral: 0.20,
        },
        topics: vec![
            "Technology".to_string(),
            "Innovation".to_string(),
            "Development".to_string(),
        ],
        speech_patterns: SpeechPatterns {
            pace: 150.0, // words per minute
            filler_words: vec!["um".to_string(), "uh".to_string()],
            repetitions: vec!["basically".to_string(), "actually".to_string()],
        },
    })
}

// Extract topics from transcript
#[tauri::command]
pub async fn extract_topics(_text: String) -> Result<Vec<String>, String> {
    // Placeholder for topic extraction
    // In production, this would use NLP/ML models
    
    Ok(vec![
        "Technology".to_string(),
        "Innovation".to_string(),
        "Software Development".to_string(),
        "AI and Machine Learning".to_string(),
    ])
}

// Export transcript in various formats
#[tauri::command]
pub async fn export_transcript(
    transcript: TranscriptionResult,
    format: String,
    path: String,
) -> Result<(), String> {
    use std::fs;
    
    let content = match format.as_str() {
        "txt" => transcript.text,
        "srt" => format_as_srt(&transcript),
        "vtt" => format_as_vtt(&transcript),
        "json" => serde_json::to_string_pretty(&transcript).map_err(|e| e.to_string())?,
        _ => return Err("Unsupported format".to_string()),
    };
    
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

fn format_as_srt(transcript: &TranscriptionResult) -> String {
    transcript.segments.iter().enumerate().map(|(i, segment)| {
        format!(
            "{}\n{} --> {}\n{}\n",
            i + 1,
            format_timestamp(segment.start),
            format_timestamp(segment.end),
            segment.text
        )
    }).collect::<Vec<_>>().join("\n")
}

fn format_as_vtt(transcript: &TranscriptionResult) -> String {
    let mut result = String::from("WEBVTT\n\n");
    for segment in &transcript.segments {
        result.push_str(&format!(
            "{} --> {}\n{}\n\n",
            format_timestamp(segment.start),
            format_timestamp(segment.end),
            segment.text
        ));
    }
    result
}

fn format_timestamp(seconds: f32) -> String {
    let hours = (seconds / 3600.0) as u32;
    let minutes = ((seconds % 3600.0) / 60.0) as u32;
    let secs = seconds % 60.0;
    format!("{:02}:{:02}:{:06.3}", hours, minutes, secs)
}

// Screen recording status
#[tauri::command]
pub async fn get_recording_status() -> Result<RecordingStatus, String> {
    // This would check actual recording status
    Ok(RecordingStatus {
        is_recording: false,
        duration: 0.0,
        devices: vec![],
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecordingStatus {
    pub is_recording: bool,
    pub duration: f32,
    pub devices: Vec<String>,
}

// Get available screens for recording
#[tauri::command]
pub async fn get_screens() -> Result<Vec<Screen>, String> {
    #[cfg(target_os = "macos")]
    {
        use screencapturekit::sc_shareable_content::SCShareableContent;
        
        let content = SCShareableContent::current();
        
        let screens = content.displays.into_iter().map(|display| Screen {
            id: format!("{}", display.display_id),
            name: format!("Display {}", display.display_id),
            width: display.width as u32,
            height: display.height as u32,
        }).collect();
        
        Ok(screens)
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        // Placeholder for other platforms
        Ok(vec![Screen {
            id: "primary".to_string(),
            name: "Primary Display".to_string(),
            width: 1920,
            height: 1080,
        }])
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Screen {
    pub id: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
}

// Start screen recording
#[tauri::command]
pub async fn start_screen_recording(
    screen_id: String,
    include_audio: bool,
) -> Result<(), String> {
    tracing::debug!("🔴 Starting screen recording - screen_id: {}, include_audio: {}", screen_id, include_audio);
    // Implementation would use platform-specific screen capture
    Ok(())
}

// Stop screen recording
#[tauri::command]
pub async fn stop_screen_recording() -> Result<String, String> {
    // Return path to recorded file
    Ok("/tmp/recording.mp4".to_string())
}

// Load a Whisper model for transcription
#[tauri::command]
pub async fn load_whisper_model(
    app_handle: tauri::AppHandle,
    model_path: String,
    gpu_device: Option<i32>,
    use_gpu: Option<bool>,
) -> Result<(), String> {
    use std::path::PathBuf;
    use vibe_core::transcribe;
    
    tracing::debug!("🔄 Loading model from: {}", model_path);
    
    let path = PathBuf::from(&model_path);
    if !path.exists() {
        return Err(format!("Model file does not exist: {}", model_path));
    }
    
    // Create WhisperContext in a blocking task
    let ctx_result = tokio::task::spawn_blocking(move || {
        transcribe::create_context(&path, gpu_device, use_gpu)
    }).await;
    
    let ctx = match ctx_result {
        Ok(Ok(context)) => context,
        Ok(Err(e)) => {
            tracing::error!("❌ Failed to create model context: {:?}", e);
            return Err(format!("Failed to create model context: {}", e));
        }
        Err(e) => {
            tracing::error!("❌ Task execution failed: {:?}", e);
            return Err(format!("Task execution failed: {}", e));
        }
    };
    
    // Store the context in app state
    let model_context = crate::setup::ModelContext {
        path: model_path,
        gpu_device,
        use_gpu,
        handle: ctx,
    };
    
    let model_state = app_handle.state::<tokio::sync::Mutex<Option<crate::setup::ModelContext>>>();
    let mut guard = model_state.lock().await;
    *guard = Some(model_context);
    
    tracing::debug!("✅ Model loaded successfully");
    Ok(())
}

// Get available models (placeholder for now)
#[tauri::command]
pub async fn get_available_models() -> Result<Vec<ModelInfo>, String> {
    // This would scan the models directory for available models
    // For now, return some common model names
    Ok(vec![
        ModelInfo {
            id: "whisper-tiny".to_string(),
            name: "Whisper Tiny".to_string(),
            size: "39 MB".to_string(),
            language: "multilingual".to_string(),
            description: "Fastest model, lower accuracy".to_string(),
        },
        ModelInfo {
            id: "whisper-base".to_string(),
            name: "Whisper Base".to_string(),
            size: "74 MB".to_string(),
            language: "multilingual".to_string(),
            description: "Good balance of speed and accuracy".to_string(),
        },
        ModelInfo {
            id: "whisper-small".to_string(),
            name: "Whisper Small".to_string(),
            size: "244 MB".to_string(),
            language: "multilingual".to_string(),
            description: "Better accuracy, slower".to_string(),
        },
    ])
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub size: String,
    pub language: String,
    pub description: String,
}