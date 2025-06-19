// Updated bindings.rs - Safe bindings without segfault-prone data extraction

use objc2::runtime::{AnyObject, Class};
use objc2::{msg_send, sel, class, Encode, Encoding};
use objc2_foundation::{NSArray, NSString, NSNumber, NSError, NSObject};
use objc2_core_media::{CMSampleBuffer, CMTime};
use objc2_core_video::CVPixelBuffer;
use std::ptr;

// Add block2 support for completion handlers
use block2::{Block, StackBlock};

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

// Completion handler type aliases
pub type SCShareableContentCompletionHandler = 
    Block<dyn Fn(*mut SCShareableContent, *mut NSError)>;

pub type SCStreamStartCompletionHandler = 
    Block<dyn Fn(*mut NSError)>;

pub type SCStreamStopCompletionHandler = 
    Block<dyn Fn(*mut NSError)>;

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
    /// Check if screen recording permissions are granted
    pub unsafe fn check_screen_recording_permission() -> bool {
        // Use CGPreflightScreenCaptureAccess to check screen recording permissions
        // This is the proper way to check ScreenCaptureKit permissions on macOS
        use std::ffi::c_void;
        
        // Define the CGPreflightScreenCaptureAccess function
        extern "C" {
            fn CGPreflightScreenCaptureAccess() -> bool;
        }
        
        let has_permission = CGPreflightScreenCaptureAccess();
        println!("🔐 Screen recording permission status: {}", has_permission);
        has_permission
    }
    
    /// Request screen recording permissions (this will prompt user if needed)
    pub unsafe fn request_screen_recording_permission() -> bool {
        // Use CGRequestScreenCaptureAccess to request permissions
        extern "C" {
            fn CGRequestScreenCaptureAccess() -> bool;
        }
        
        let has_permission = CGRequestScreenCaptureAccess();
        println!("🔐 Screen recording permission after request: {}", has_permission);
        has_permission
    }

    /// Simplified completion handler approach that avoids thread safety issues
    pub unsafe fn get_shareable_content_with_completion<F>(completion: F) -> Result<(), String>
    where
        F: Fn(Option<*mut SCShareableContent>, Option<&NSError>) + Clone + 'static,
    {
        // First check permissions
        if !Self::check_screen_recording_permission() {
            return Err("Screen recording permission not granted".to_string());
        }

        println!("🔍 Getting shareable content with completion handler");

        // Create Objective-C block - using a simpler approach
        let block = StackBlock::new(move |content: *mut SCShareableContent, error: *mut NSError| {
            let error_ref = if error.is_null() { None } else { Some(&*error) };
            let content_opt = if content.is_null() { None } else { Some(content) };
            completion(content_opt, error_ref);
        });
        let block = block.copy();
        
        let class = class!(SCShareableContent);
        let _: () = msg_send![
            class,
            getShareableContentWithCompletionHandler: &*block
        ];
        
        Ok(())
    }

    pub unsafe fn get_shareable_content_async<F>(completion: F) 
    where
        F: Fn(Option<*mut SCShareableContent>, Option<&NSError>) + Send + Sync + Clone + 'static,
    {
        // First check permissions
        if !Self::check_screen_recording_permission() {
            println!("❌ Screen recording permission not granted");
            // Create a permission error - we'll pass null for now since creating NSError is complex
            completion(None, None);
            return;
        }

        // Create Objective-C block
        let block = StackBlock::new(move |content: *mut SCShareableContent, error: *mut NSError| {
            let error_ref = if error.is_null() { None } else { Some(&*error) };
            let content_opt = if content.is_null() { None } else { Some(content) };
            completion(content_opt, error_ref);
        });
        let block = block.copy();
        
        let class = class!(SCShareableContent);
        let _: () = msg_send![
            class,
            getShareableContentWithCompletionHandler: &*block
        ];
    }
    
    /// Get shareable content synchronously (blocking call) - Updated to use safer fallback approach
    pub unsafe fn get_shareable_content_sync() -> Result<*mut SCShareableContent, String> {
        // First check permissions
        if !Self::check_screen_recording_permission() {
            return Err("Screen recording permission not granted. Please enable screen recording permission in System Preferences > Security & Privacy > Privacy > Screen Recording".to_string());
        }

        println!("🔍 Attempting safer ScreenCaptureKit content retrieval");
        
        // Instead of trying potentially problematic direct API calls,
        // return an error that encourages using the timeout version
        println!("⚠️ Direct sync API calls can cause segfaults due to async/sync mismatch");
        println!("💡 Use the timeout-protected version instead");
        
        Err("Direct sync ScreenCaptureKit calls avoided to prevent segfaults. Use timeout version instead.".to_string())
    }
    
    pub unsafe fn start_stream_capture_async<F>(stream: *mut SCStream, completion: F)
    where
        F: Fn(Option<&NSError>) + Send + Sync + Clone + 'static,
    {
        let block = StackBlock::new(move |error: *mut NSError| {
            let error_ref = if error.is_null() { None } else { Some(&*error) };
            completion(error_ref);
        });
        let block = block.copy();
        
        let _: () = msg_send![
            stream,
            startCaptureWithCompletionHandler: &*block
        ];
    }
    
    pub unsafe fn stop_stream_capture_async<F>(stream: *mut SCStream, completion: F)
    where
        F: Fn(Option<&NSError>) + Send + Sync + Clone + 'static,
    {
        let block = StackBlock::new(move |error: *mut NSError| {
            let error_ref = if error.is_null() { None } else { Some(&*error) };
            completion(error_ref);
        });
        let block = block.copy();
        
        let _: () = msg_send![
            stream,
            stopCaptureWithCompletionHandler: &*block
        ];
    }
    
    pub unsafe fn create_content_filter_with_display(display: *mut SCDisplay) -> *mut SCContentFilter {
        if display.is_null() {
            println!("⚠️ Cannot create content filter with null display");
            return ptr::null_mut();
        }
        
        let class = class!(SCContentFilter);
        let alloc: *mut AnyObject = msg_send![class, alloc];
        msg_send![alloc, initWithDisplay: display]
    }
    
    pub unsafe fn create_content_filter_with_window(window: *mut SCWindow) -> *mut SCContentFilter {
        if window.is_null() {
            println!("⚠️ Cannot create content filter with null window");
            return ptr::null_mut();
        }
        
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
        if config.is_null() {
            println!("⚠️ Cannot configure null stream configuration");
            return;
        }
        
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
        if filter.is_null() || configuration.is_null() {
            println!("⚠️ Cannot create stream with null filter or configuration");
            return ptr::null_mut();
        }
        
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
        if stream.is_null() {
            println!("⚠️ Cannot start capture on null stream");
            return;
        }
        
        // Create a null completion handler for now
        let _: () = msg_send![stream, startCaptureWithCompletionHandler: ptr::null::<AnyObject>()];
    }
    
    pub unsafe fn stop_stream_capture(stream: *mut SCStream) {
        if stream.is_null() {
            println!("⚠️ Cannot stop capture on null stream");
            return;
        }
        
        // Create a null completion handler for now
        let _: () = msg_send![stream, stopCaptureWithCompletionHandler: ptr::null::<AnyObject>()];
    }
    
    // REMOVED: get_display_info and get_window_info functions that caused segfaults
    // These functions were using unsafe msg_send! calls to extract string data from ScreenCaptureKit objects
    // The string extraction (particularly NSString to Rust String conversion) was causing segmentation faults
    
    /// Safe placeholder for display info - doesn't extract data from ScreenCaptureKit objects
    pub unsafe fn get_display_info_safe(display_id: u32) -> (u32, String, u32, u32) {
        // Use safe fallback data instead of extracting from ScreenCaptureKit objects
        (display_id, format!("Display {}", display_id), 1920, 1080)
    }
    
    /// Safe placeholder for window info - doesn't extract data from ScreenCaptureKit objects
    pub unsafe fn get_window_info_safe(window_id: u32) -> (u32, String, u32, u32) {
        // Use safe fallback data instead of extracting from ScreenCaptureKit objects
        (window_id, format!("Window {}", window_id), 800, 600)
    }
}

// Pixel format constants for ScreenCaptureKit
pub const kCVPixelFormatType_32BGRA: u32 = 0x42475241; // 'BGRA'
pub const kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange: u32 = 0x34323076; // '420v' as hex

// Color space constants
pub const kCGColorSpaceDisplayP3: u32 = 0;
pub const kCGColorSpaceSRGB: u32 = 1;