use objc2::runtime::{AnyObject, Class};
use objc2::{msg_send, sel, class, Encode, Encoding};
use objc2_foundation::{NSArray, NSString, NSNumber, NSError, NSObject};
use objc2_core_media::{CMSampleBuffer, CMTime};
use objc2_core_video::CVPixelBuffer;
use std::ptr;

// ScreenCaptureKit Class Names - we'll use AnyObject for the actual instances
// and these constants for class lookup

pub const SC_SHAREABLE_CONTENT_CLASS: &str = "SCShareableContent";
pub const SC_DISPLAY_CLASS: &str = "SCDisplay";
pub const SC_WINDOW_CLASS: &str = "SCWindow";
pub const SC_CONTENT_FILTER_CLASS: &str = "SCContentFilter";
pub const SC_STREAM_CLASS: &str = "SCStream";
pub const SC_STREAM_CONFIGURATION_CLASS: &str = "SCStreamConfiguration";

// Type aliases for better code readability
pub type SCShareableContent = AnyObject;
pub type SCDisplay = AnyObject;
pub type SCWindow = AnyObject;
pub type SCContentFilter = AnyObject;
pub type SCStream = AnyObject;
pub type SCStreamConfiguration = AnyObject;

// SCStreamDelegate Protocol
// This needs to be implemented as a Rust struct that conforms to the protocol
pub trait SCStreamDelegate {
    fn stream_did_output_sample_buffer(&self, stream: &SCStream, sample_buffer: &CMSampleBuffer, of_type: SCStreamOutputType);
    fn stream_did_stop_with_error(&self, stream: &SCStream, error: Option<&NSError>);
}

// SCStreamOutputType enum
#[repr(u32)]
#[derive(Debug, Clone, Copy)]
pub enum SCStreamOutputType {
    Screen = 0,
    Audio = 1,
    Microphone = 2,
}

unsafe impl Encode for SCStreamOutputType {
    const ENCODING: Encoding = u32::ENCODING;
}

// Core Graphics structures for frame handling
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct CGRect {
    pub origin: CGPoint,
    pub size: CGSize,
}

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct CGPoint {
    pub x: f64,
    pub y: f64,
}

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct CGSize {
    pub width: f64,
    pub height: f64,
}

unsafe impl Encode for CGRect {
    const ENCODING: Encoding = Encoding::Struct("CGRect", &[CGPoint::ENCODING, CGSize::ENCODING]);
}

unsafe impl Encode for CGPoint {
    const ENCODING: Encoding = Encoding::Struct("CGPoint", &[f64::ENCODING, f64::ENCODING]);
}

unsafe impl Encode for CGSize {
    const ENCODING: Encoding = Encoding::Struct("CGSize", &[f64::ENCODING, f64::ENCODING]);
}

// Helper functions for ScreenCaptureKit API calls using AnyObject
pub struct ScreenCaptureKitHelpers;

impl ScreenCaptureKitHelpers {
    pub unsafe fn get_shareable_content_with_completion_handler<F>(completion: F) 
    where
        F: FnOnce(Option<*mut SCShareableContent>, Option<&NSError>) + Send + 'static,
    {
        // This would create a proper Objective-C block and call the API
        // For now, we'll implement the foundation
        let _class = class!(SCShareableContent);
        // Implementation will be completed in the next phase
        
        // Simulate completion for now
        completion(None, None);
    }
    
    pub unsafe fn create_content_filter_with_display(display: *mut SCDisplay) -> *mut SCContentFilter {
        let class = class!(SCContentFilter);
        let alloc: *mut AnyObject = msg_send![class, alloc];
        msg_send![alloc, initWithDisplay: display]
    }
    
    pub unsafe fn create_content_filter_with_window(window: *mut SCWindow) -> *mut SCContentFilter {
        let class = class!(SCContentFilter);
        let alloc: *mut AnyObject = msg_send![class, alloc];
        msg_send![alloc, initWithDesktopIndependentWindow: window]
    }
    
    pub unsafe fn create_stream_configuration() -> *mut SCStreamConfiguration {
        let class = class!(SCStreamConfiguration);
        let alloc: *mut AnyObject = msg_send![class, alloc];
        msg_send![alloc, init]
    }
    
    pub unsafe fn configure_stream_configuration(
        config: *mut SCStreamConfiguration,
        width: u32,
        height: u32,
        fps: u32,
        shows_cursor: bool,
        captures_audio: bool,
        pixel_format: u32,
        color_space: u32,
    ) {
        let _: () = msg_send![config, setWidth: width];
        let _: () = msg_send![config, setHeight: height];
        
        // Set frame rate (convert fps to CMTime)
        let frame_interval = CMTime {
            value: 1,
            timescale: fps as i32,
            flags: objc2_core_media::CMTimeFlags(0),
            epoch: 0,
        };
        let _: () = msg_send![config, setMinimumFrameInterval: frame_interval];
        
        let _: () = msg_send![config, setShowsCursor: shows_cursor];
        let _: () = msg_send![config, setCapturesAudio: captures_audio];
        let _: () = msg_send![config, setPixelFormat: pixel_format];
        let _: () = msg_send![config, setColorSpace: color_space];
    }
    
    pub unsafe fn create_stream(
        filter: *mut SCContentFilter,
        configuration: *mut SCStreamConfiguration,
        delegate: *mut AnyObject,
    ) -> *mut SCStream {
        let class = class!(SCStream);
        let alloc: *mut AnyObject = msg_send![class, alloc];
        msg_send![
            alloc,
            initWithFilter: filter,
            configuration: configuration,
            delegate: delegate
        ]
    }
    
    pub unsafe fn start_stream_capture(stream: *mut SCStream) {
        // Create a null completion handler for now
        let _: () = msg_send![stream, startCaptureWithCompletionHandler: ptr::null::<AnyObject>()];
    }
    
    pub unsafe fn stop_stream_capture(stream: *mut SCStream) {
        // Create a null completion handler for now
        let _: () = msg_send![stream, stopCaptureWithCompletionHandler: ptr::null::<AnyObject>()];
    }
    
    // Helper methods for extracting data from ScreenCaptureKit objects
    pub unsafe fn get_display_info(display: *mut SCDisplay) -> (u32, String, u32, u32) {
        let display_id: u32 = msg_send![display, displayID];
        let localized_name: *mut NSString = msg_send![display, localizedName];
        let width: u32 = msg_send![display, width];
        let height: u32 = msg_send![display, height];
        
        let name = if !localized_name.is_null() {
            // Convert NSString to Rust String - simplified for now
            format!("Display {}", display_id)
        } else {
            format!("Display {}", display_id)
        };
        
        (display_id, name, width, height)
    }
    
    pub unsafe fn get_window_info(window: *mut SCWindow) -> (u32, String, u32, u32) {
        let window_id: u32 = msg_send![window, windowID];
        let title: *mut NSString = msg_send![window, title];
        let frame: CGRect = msg_send![window, frame];
        
        let title_str = if !title.is_null() {
            // Convert NSString to Rust String - simplified for now
            format!("Window {}", window_id)
        } else {
            format!("Window {}", window_id)
        };
        
        (window_id, title_str, frame.size.width as u32, frame.size.height as u32)
    }
}

// Pixel format constants for ScreenCaptureKit
pub const kCVPixelFormatType_32BGRA: u32 = 0x42475241; // 'BGRA'
pub const kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange: u32 = 0x34323076; // '420v' as hex

// Color space constants
pub const kCGColorSpaceDisplayP3: u32 = 0;
pub const kCGColorSpaceSRGB: u32 = 1; 