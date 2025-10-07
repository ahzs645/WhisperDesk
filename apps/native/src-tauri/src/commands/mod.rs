// Module declarations for Tauri commands
pub mod app_commands;
pub mod audio_commands;
pub mod audio_recorder_commands;
pub mod model_commands;
pub mod settings_commands;
pub mod transcription_commands;

// Re-export all commands for easy access
pub use app_commands::*;
pub use audio_commands::*;
pub use audio_recorder_commands::*;
pub use model_commands::*;
pub use settings_commands::*;
pub use transcription_commands::*;
