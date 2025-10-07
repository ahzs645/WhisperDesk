// Module declarations for Tauri commands
pub mod app_commands;
pub mod settings_commands;
pub mod transcription_commands;

// Re-export all commands for easy access
pub use app_commands::*;
pub use settings_commands::*;
pub use transcription_commands::*;
