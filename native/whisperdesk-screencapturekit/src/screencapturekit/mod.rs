// ScreenCaptureKit implementation with objc2 bindings

pub mod bindings;
pub mod content;
pub mod audio;
pub mod stream;
pub mod delegate;

// Re-export key types for easier access
pub use content::{ContentManager, ShareableContent, DisplayInfo, WindowInfo};
pub use audio::AudioManager;
pub use stream::{RealStreamManager, RealContentFilter, StreamManager, MockContentFilter};
pub use delegate::RealStreamDelegate;
pub use bindings::{
    SCStream, SCStreamConfiguration, SCContentFilter, SCDisplay, SCWindow,
    SCStreamDelegate, SCStreamOutputType,
    kCVPixelFormatType_32BGRA, kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
    kCGColorSpaceDisplayP3, kCGColorSpaceSRGB,
    CGRect, CGPoint, CGSize
}; 