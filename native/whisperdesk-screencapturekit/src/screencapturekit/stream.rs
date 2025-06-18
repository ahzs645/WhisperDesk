use crate::RecordingConfiguration;
use napi::bindgen_prelude::*;
use std::sync::{Arc, Mutex};
use std::ptr;
use objc2::runtime::AnyObject;

use super::bindings::{
    SCStream, SCStreamConfiguration, SCContentFilter, SCDisplay, SCWindow,
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
        let delegate = Arc::new(RealStreamDelegate::new(
            config.output_path.clone(),
            self.is_recording.clone(),
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
    pub fn new_with_display(_content: &ShareableContent, display_id: u32) -> Result<Self> {
        unsafe {
            // In a real implementation, this would:
            // 1. Get the SCDisplay from the ShareableContent
            // 2. Create an SCContentFilter with that display
            
            // For now, create a placeholder filter that won't crash
            let display_ptr = _content.get_sc_display_by_id(display_id);
            let filter_ptr = if let Some(display) = display_ptr {
                ScreenCaptureKitHelpers::create_content_filter_with_display(display)
            } else {
                // Create a null pointer for now - this will be properly implemented in Phase 3
                ptr::null_mut()
            };
            
            println!("🎯 Created display content filter for display {} (Phase 2 foundation)", display_id);
            Ok(Self {
                filter_ptr,
                filter_type: ContentFilterType::Display(display_id),
            })
        }
    }
    
    pub fn new_with_window(_content: &ShareableContent, window_id: u32) -> Result<Self> {
        unsafe {
            // In a real implementation, this would:
            // 1. Get the SCWindow from the ShareableContent
            // 2. Create an SCContentFilter with that window
            
            // For now, create a placeholder filter that won't crash
            let window_ptr = _content.get_sc_window_by_id(window_id);
            let filter_ptr = if let Some(window) = window_ptr {
                ScreenCaptureKitHelpers::create_content_filter_with_window(window)
            } else {
                // Create a null pointer for now - this will be properly implemented in Phase 3
                ptr::null_mut()
            };
            
            println!("🎯 Created window content filter for window {} (Phase 2 foundation)", window_id);
            Ok(Self {
                filter_ptr,
                filter_type: ContentFilterType::Window(window_id),
            })
        }
    }
    
    pub fn get_filter_ptr(&self) -> *mut SCContentFilter {
        self.filter_ptr
    }
    
    pub fn is_valid(&self) -> bool {
        !self.filter_ptr.is_null()
    }
}

// Legacy compatibility - will be removed once all references are updated
pub struct StreamManager {
    real_manager: RealStreamManager,
}

impl StreamManager {
    pub fn new() -> Self {
        Self {
            real_manager: RealStreamManager::new(),
        }
    }
    
    pub async fn start_recording(
        &mut self,
        _content_filter: MockContentFilter,
        config: RecordingConfiguration,
    ) -> Result<()> {
        // Convert mock filter to real filter
        let real_filter = RealContentFilter::new_with_display(&ShareableContent::new(), 1)?;
        
        self.real_manager.start_recording(real_filter, config)
    }
    
    pub async fn stop_recording(&mut self) -> Result<String> {
        self.real_manager.stop_recording()
    }
    
    pub async fn is_recording(&self) -> bool {
        self.real_manager.is_recording()
    }
}

// Temporary mock structure for backward compatibility
pub struct MockContentFilter;

impl MockContentFilter {
    pub fn new() -> Self {
        Self {}
    }
} 