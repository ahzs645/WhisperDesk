use crate::RecordingConfiguration;
use napi::bindgen_prelude::*;
use std::sync::{Arc, Mutex};

use super::bindings::{
    SCStream, SCStreamConfiguration, SCContentFilter,
    kCVPixelFormatType_32BGRA, kCGColorSpaceSRGB, ScreenCaptureKitHelpers
};
use super::delegate::RealStreamDelegate;
use super::content::ShareableContent;

pub struct RealStreamManager {
    stream: Option<*mut SCStream>,
    delegate: Option<Arc<RealStreamDelegate>>,
    is_recording: Arc<Mutex<bool>>,
    output_path: Option<String>,
}

impl RealStreamManager {
    pub fn new() -> Self {
        Self {
            stream: None,
            delegate: None,
            is_recording: Arc::new(Mutex::new(false)),
            output_path: None,
        }
    }
    
    pub fn start_recording(
        &mut self,
        content_filter: RealContentFilter,
        config: RecordingConfiguration,
    ) -> Result<()> {
        println!("🎬 Starting real ScreenCaptureKit stream");
        
        // Create stream configuration
        let stream_config = self.create_stream_configuration(&config)?;
        
        // Create delegate
        let width = config.width.unwrap_or(1920);
        let height = config.height.unwrap_or(1080);
        let fps = config.fps.unwrap_or(30);
        
        let delegate = Arc::new(RealStreamDelegate::new(
            config.output_path.clone(),
            self.is_recording.clone(),
            width,
            height,
            fps,
        ));
        
        // Create the actual SCStream instance
        let stream = self.create_sc_stream(&content_filter, stream_config, &delegate)?;
        
        // Start capture
        self.start_capture(stream)?;
        
        // Store references
        self.stream = Some(stream);
        self.delegate = Some(delegate);
        self.output_path = Some(config.output_path);
        *self.is_recording.lock().unwrap() = true;
        
        println!("✅ Real ScreenCaptureKit stream started successfully");
        Ok(())
    }
    
    pub fn stop_recording(&mut self) -> Result<String> {
        println!("🛑 Stopping real ScreenCaptureKit stream");
        
        if let Some(stream) = self.stream.take() {
            self.stop_capture(stream)?;
        }
        
        *self.is_recording.lock().unwrap() = false;
        
        let output_path = self.output_path.take().unwrap_or_default();
        
        // Clean up delegate
        self.delegate = None;
        
        println!("✅ Real ScreenCaptureKit stream stopped");
        Ok(output_path)
    }
    
    pub fn is_recording(&self) -> bool {
        *self.is_recording.lock().unwrap()
    }
    
    fn create_stream_configuration(&self, config: &RecordingConfiguration) -> Result<*mut SCStreamConfiguration> {
        unsafe {
            let stream_config = ScreenCaptureKitHelpers::create_stream_configuration();
            if stream_config.is_null() {
                return Err(Error::new(Status::GenericFailure, "Failed to create stream configuration"));
            }
            
            // Set configuration parameters
            let width = config.width.unwrap_or(1920);
            let height = config.height.unwrap_or(1080);
            let fps = config.fps.unwrap_or(30);
            let shows_cursor = config.show_cursor.unwrap_or(true);
            let captures_audio = config.capture_audio.unwrap_or(false);
            
            ScreenCaptureKitHelpers::configure_stream_configuration(
                stream_config,
                width,
                height,
                fps,
                shows_cursor,
                captures_audio,
                kCVPixelFormatType_32BGRA,
                kCGColorSpaceSRGB,
            );
            
            println!("📐 Stream configuration created: {}x{} @ {}fps", width, height, fps);
            Ok(stream_config)
        }
    }
    
    fn create_sc_stream(
        &self,
        content_filter: &RealContentFilter,
        configuration: *mut SCStreamConfiguration,
        delegate: &Arc<RealStreamDelegate>,
    ) -> Result<*mut SCStream> {
        unsafe {
            // Create the delegate object that implements SCStreamDelegate protocol
            let objc_delegate = delegate.create_objc_delegate();
            
            // Create the SCStream instance
            let stream = ScreenCaptureKitHelpers::create_stream(
                content_filter.get_filter_ptr(),
                configuration,
                objc_delegate,
            );
            
            if stream.is_null() {
                return Err(Error::new(Status::GenericFailure, "Failed to create SCStream"));
            }
            
            println!("🎯 SCStream instance created successfully");
            Ok(stream)
        }
    }
    
    fn start_capture(&self, stream: *mut SCStream) -> Result<()> {
        unsafe {
            ScreenCaptureKitHelpers::start_stream_capture(stream);
            println!("🎥 Capture started on SCStream");
            Ok(())
        }
    }
    
    fn stop_capture(&self, stream: *mut SCStream) -> Result<()> {
        unsafe {
            ScreenCaptureKitHelpers::stop_stream_capture(stream);
            println!("🛑 Capture stopped on SCStream");
            Ok(())
        }
    }
    
    pub fn get_frame_count(&self) -> u64 {
        if let Some(ref delegate) = self.delegate {
            delegate.get_frame_count()
        } else {
            0
        }
    }
    
    pub fn get_audio_frame_count(&self) -> u64 {
        if let Some(ref delegate) = self.delegate {
            delegate.get_audio_frame_count()
        } else {
            0
        }
    }
}

// Real content filter implementation
pub struct RealContentFilter {
    filter_ptr: *mut SCContentFilter,
    filter_type: ContentFilterType,
}

#[derive(Debug, Clone)]
enum ContentFilterType {
    Display(u32),
    Window(u32),
}

impl RealContentFilter {
    pub fn new_with_display(content: &ShareableContent, display_id: u32) -> Result<Self> {
        unsafe {
            // Get the real SCDisplay from ShareableContent
            if let Some(sc_display) = content.get_sc_display_by_id(display_id) {
                let filter_ptr = ScreenCaptureKitHelpers::create_content_filter_with_display(sc_display);
                if filter_ptr.is_null() {
                    return Err(Error::new(Status::GenericFailure, "Failed to create display content filter"));
                }
                
                println!("✅ Created real display content filter for display {}", display_id);
                Ok(Self {
                    filter_ptr,
                    filter_type: ContentFilterType::Display(display_id),
                })
            } else {
                Err(Error::new(Status::InvalidArg, format!("Display with ID {} not found", display_id)))
            }
        }
    }
    
    pub fn new_with_window(content: &ShareableContent, window_id: u32) -> Result<Self> {
        unsafe {
            // Get the real SCWindow from ShareableContent
            if let Some(sc_window) = content.get_sc_window_by_id(window_id) {
                let filter_ptr = ScreenCaptureKitHelpers::create_content_filter_with_window(sc_window);
                if filter_ptr.is_null() {
                    return Err(Error::new(Status::GenericFailure, "Failed to create window content filter"));
                }
                
                println!("✅ Created real window content filter for window {}", window_id);
                Ok(Self {
                    filter_ptr,
                    filter_type: ContentFilterType::Window(window_id),
                })
            } else {
                Err(Error::new(Status::InvalidArg, format!("Window with ID {} not found", window_id)))
            }
        }
    }
    
    pub fn get_filter_ptr(&self) -> *mut SCContentFilter {
        self.filter_ptr
    }
    
    pub fn is_valid(&self) -> bool {
        !self.filter_ptr.is_null()
    }
}

// Note: Legacy StreamManager and MockContentFilter have been removed.
// All code should now use RealStreamManager and RealContentFilter directly. 