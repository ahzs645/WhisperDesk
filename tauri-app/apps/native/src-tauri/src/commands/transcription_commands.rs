use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionOptions {
    pub model: String,
    pub language: Option<String>,
    pub task: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub segments: Vec<TranscriptionSegment>,
    pub duration: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionSegment {
    pub id: u32,
    pub start: f64,
    pub end: f64,
    pub text: String,
}

/// Start a transcription
/// Maps to: transcription:start from Electron
#[tauri::command]
pub async fn start_transcription(
    options: TranscriptionOptions,
) -> Result<TranscriptionResult, String> {
    // TODO: Implement actual transcription logic
    // This will call the whisper-cli binary or use a Rust whisper library

    println!("Starting transcription with model: {}", options.model);

    // Placeholder response
    Ok(TranscriptionResult {
        text: "This is a placeholder transcription".to_string(),
        segments: vec![TranscriptionSegment {
            id: 0,
            start: 0.0,
            end: 2.5,
            text: "This is a placeholder transcription".to_string(),
        }],
        duration: 2.5,
    })
}

/// Stop a transcription
/// Maps to: transcription:stop from Electron
#[tauri::command]
pub async fn stop_transcription() -> Result<(), String> {
    // TODO: Implement stop logic
    println!("Stopping transcription");
    Ok(())
}

/// Get transcription status
/// Maps to: transcription:getStatus from Electron
#[tauri::command]
pub async fn get_transcription_status() -> Result<String, String> {
    // TODO: Implement status check
    Ok("idle".to_string())
}

/// List available models
/// Maps to: models:list from Electron
#[tauri::command]
pub async fn list_models() -> Result<Vec<String>, String> {
    // TODO: Read from models directory
    Ok(vec![
        "tiny".to_string(),
        "base".to_string(),
        "small".to_string(),
        "medium".to_string(),
    ])
}
