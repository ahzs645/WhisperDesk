use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

/// Get list of available audio input devices
#[tauri::command]
pub async fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    // TODO: Implement actual audio device enumeration
    // This will depend on the platform and audio library you choose
    // For now, return a mock device

    Ok(vec![AudioDevice {
        id: "default".to_string(),
        name: "Default Microphone".to_string(),
        is_default: true,
    }])
}

/// Get the path to ffmpeg
#[tauri::command]
pub async fn get_ffmpeg_path() -> Result<String, String> {
    vibe_core::audio::find_ffmpeg_path()
        .and_then(|p| p.to_str().map(|s| s.to_string()))
        .ok_or_else(|| "FFmpeg not found".to_string())
}
