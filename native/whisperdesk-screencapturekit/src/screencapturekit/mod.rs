// ScreenCaptureKit implementation with objc2 bindings

pub mod bindings;
pub mod content;
pub mod audio;
pub mod stream;
pub mod delegate;
pub mod encoder;

// Re-export key types for easier access
pub use content::ShareableContent;
pub use audio::AudioManager;
 