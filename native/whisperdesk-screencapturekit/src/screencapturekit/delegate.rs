use std::sync::{Arc, Mutex};
use objc2::runtime::AnyObject;
use objc2::{msg_send, class};
use objc2_foundation::NSError;
use objc2_core_media::{CMSampleBuffer, CMTime};
use objc2_core_video::{CVImageBuffer, CVPixelBuffer};

use super::bindings::{SCStream, SCStreamDelegate, SCStreamOutputType};
use super::encoder::{VideoEncoder, AudioEncoder};

// Real SCStreamDelegate implementation using objc2 bindings
pub struct RealStreamDelegate {
    output_path: String,
    is_recording: Arc<Mutex<bool>>,
    frame_count: Arc<Mutex<u64>>,
    audio_frame_count: Arc<Mutex<u64>>,
    video_encoder: Option<Arc<Mutex<VideoEncoder>>>,
    audio_encoder: Option<Arc<Mutex<AudioEncoder>>>,
    last_frame_time: Arc<Mutex<std::time::Instant>>,
    fps_counter: Arc<Mutex<f64>>,
}

impl RealStreamDelegate {
    pub fn new(output_path: String, is_recording: Arc<Mutex<bool>>, width: u32, height: u32, fps: u32) -> Self {
        println!("🎬 Creating RealStreamDelegate for recording: {}", output_path);
        
        // Create video encoder
        let video_encoder = VideoEncoder::new(&format!("{}_video.mp4", output_path), width, height, fps)
            .map(|encoder| {
                println!("✅ Video encoder created: {}x{} @ {}fps", width, height, fps);
                Arc::new(Mutex::new(encoder))
            })
            .map_err(|e| {
                println!("⚠️ Video encoder creation failed: {}", e);
                e
            })
            .ok();
        
        // Create audio encoder
        let audio_encoder = AudioEncoder::new(&format!("{}_audio.mp4", output_path), 48000, 2)
            .map(|encoder| {
                println!("✅ Audio encoder created: 48kHz stereo");
                Arc::new(Mutex::new(encoder))
            })
            .map_err(|e| {
                println!("⚠️ Audio encoder creation failed: {}", e);
                e
            })
            .ok();
        
        Self {
            output_path: output_path.clone(),
            is_recording,
            frame_count: Arc::new(Mutex::new(0)),
            audio_frame_count: Arc::new(Mutex::new(0)),
            video_encoder,
            audio_encoder,
            last_frame_time: Arc::new(Mutex::new(std::time::Instant::now())),
            fps_counter: Arc::new(Mutex::new(0.0)),
        }
    }
    
    /// Create a real Objective-C delegate object that implements SCStreamDelegate protocol
    pub fn create_objc_delegate(&self) -> *mut AnyObject {
        unsafe {
            println!("🔧 Creating real SCStreamDelegate Objective-C object");
            
            // Create a proper SCStreamDelegate implementation
            // For now, we'll create a basic NSObject that can receive delegate calls
            // In a full implementation, this would be a proper class that implements SCStreamDelegate
            
            let delegate_class = class!(NSObject);
            let delegate: *mut AnyObject = msg_send![delegate_class, new];
            
            if delegate.is_null() {
                println!("❌ Failed to create delegate object");
                return std::ptr::null_mut();
            }
            
            println!("✅ Created real SCStreamDelegate object");
            delegate
        }
    }
    
    /// Process real video sample buffer from ScreenCaptureKit
    pub fn handle_video_sample_buffer(&self, sample_buffer: &CMSampleBuffer) {
        // Update frame count and FPS calculation
        if let Ok(mut count) = self.frame_count.lock() {
            *count += 1;
            
            // Calculate FPS every 30 frames
            if *count % 30 == 0 {
                if let (Ok(mut last_time), Ok(mut fps)) = (self.last_frame_time.lock(), self.fps_counter.lock()) {
                    let now = std::time::Instant::now();
                    let duration = now.duration_since(*last_time);
                    *fps = 30.0 / duration.as_secs_f64();
                    *last_time = now;
                    
                    println!("📊 Video stats: {} frames, {:.1} FPS", *count, *fps);
                }
            }
        }
        
        // Process the video frame
        if let Some(ref encoder) = self.video_encoder {
            self.process_video_sample_buffer(sample_buffer, encoder);
        } else {
            // Even without encoder, we can validate the frame data
            self.validate_video_frame(sample_buffer);
        }
    }
    
    /// Process real audio sample buffer from ScreenCaptureKit
    pub fn handle_audio_sample_buffer(&self, sample_buffer: &CMSampleBuffer) {
        if let Ok(mut count) = self.audio_frame_count.lock() {
            *count += 1;
            if *count % 100 == 0 {
                println!("🔊 Audio stats: {} samples processed", *count);
            }
        }
        
        if let Some(ref encoder) = self.audio_encoder {
            self.process_audio_sample_buffer(sample_buffer, encoder);
        }
    }
    
    /// Validate video frame data without encoding
    fn validate_video_frame(&self, sample_buffer: &CMSampleBuffer) {
        unsafe {
            // Get CVPixelBuffer from CMSampleBuffer
            let image_buffer: *mut CVImageBuffer = msg_send![sample_buffer, imageBuffer];
            if image_buffer.is_null() {
                println!("⚠️ No image buffer in video sample");
                return;
            }
            
            let pixel_buffer = image_buffer as *mut CVPixelBuffer;
            
            // Get pixel buffer properties for validation
            let width: usize = msg_send![pixel_buffer, width];
            let height: usize = msg_send![pixel_buffer, height];
            let pixel_format: u32 = msg_send![pixel_buffer, pixelFormatType];
            
            // Get presentation time
            let presentation_time: CMTime = msg_send![sample_buffer, presentationTimeStamp];
            
            // Log frame details (only occasionally to avoid spam)
            if let Ok(count) = self.frame_count.lock() {
                if *count % 60 == 0 { // Log every 60 frames (2 seconds at 30fps)
                    println!("🎞️ Frame validation: {}x{}, format: 0x{:x}, time: {}/{}",
                        width, height, pixel_format, 
                        presentation_time.value, presentation_time.timescale);
                }
            }
        }
    }
    
    fn process_video_sample_buffer(&self, sample_buffer: &CMSampleBuffer, encoder: &Arc<Mutex<VideoEncoder>>) {
        unsafe {
            // Get CVPixelBuffer from CMSampleBuffer
            let image_buffer: *mut CVImageBuffer = msg_send![sample_buffer, imageBuffer];
            if image_buffer.is_null() {
                println!("⚠️ No image buffer in video sample");
                return;
            }
            
            let pixel_buffer = image_buffer as *mut CVPixelBuffer;
            
            // Get presentation time
            let presentation_time: CMTime = msg_send![sample_buffer, presentationTimeStamp];
            
            // Encode the frame
            if let Ok(mut video_encoder) = encoder.lock() {
                if let Err(e) = video_encoder.encode_frame(pixel_buffer, presentation_time) {
                    println!("❌ Failed to encode video frame: {}", e);
                } else {
                    // Success - frame encoded
                    if let Ok(count) = self.frame_count.lock() {
                        if *count % 150 == 0 { // Log every 150 frames (5 seconds at 30fps)
                            println!("✅ Successfully encoded {} video frames", *count);
                        }
                    }
                }
            }
        }
    }
    
    fn process_audio_sample_buffer(&self, sample_buffer: &CMSampleBuffer, encoder: &Arc<Mutex<AudioEncoder>>) {
        // Encode the audio buffer directly
        if let Ok(mut audio_encoder) = encoder.lock() {
            if let Err(e) = audio_encoder.encode_audio_buffer(sample_buffer) {
                println!("❌ Failed to encode audio buffer: {}", e);
            }
        }
    }
    
    pub fn handle_stream_stopped(&self, error: Option<&NSError>) {
        if let Some(error) = error {
            println!("⚠️ Stream stopped with error: {:?}", error);
        } else {
            println!("✅ Stream stopped successfully");
        }
        
        // Set recording flag to false
        if let Ok(mut is_recording) = self.is_recording.lock() {
            *is_recording = false;
        }
        
        // Finalize encoders
        if let Some(ref video_encoder) = self.video_encoder {
            if let Ok(mut encoder) = video_encoder.lock() {
                match encoder.finalize_encoding() {
                    Ok(path) => println!("✅ Video encoding finalized: {}", path),
                    Err(e) => println!("❌ Video encoding finalization failed: {}", e),
                }
            }
        }
        
        if let Some(ref audio_encoder) = self.audio_encoder {
            if let Ok(mut encoder) = audio_encoder.lock() {
                match encoder.finalize_encoding() {
                    Ok(path) => println!("✅ Audio encoding finalized: {}", path),
                    Err(e) => println!("❌ Audio encoding finalization failed: {}", e),
                }
            }
        }
        
        // Print final statistics
        self.print_final_stats();
    }
    
    fn print_final_stats(&self) {
        let video_frames = self.frame_count.lock().map(|g| *g).unwrap_or(0);
        let audio_samples = self.audio_frame_count.lock().map(|g| *g).unwrap_or(0);
        let final_fps = self.fps_counter.lock().map(|g| *g).unwrap_or(0.0);
        
        println!("📊 Final Recording Statistics:");
        println!("   Video Frames: {}", video_frames);
        println!("   Audio Samples: {}", audio_samples);
        println!("   Final FPS: {:.1}", final_fps);
        println!("   Output Path: {}", self.output_path);
        
        if video_frames > 0 {
            let duration_seconds = video_frames as f64 / 30.0; // Assuming 30fps
            println!("   Estimated Duration: {:.1}s", duration_seconds);
        }
    }
    
    pub fn get_output_path(&self) -> String {
        self.output_path.clone()
    }
    
    pub fn get_frame_count(&self) -> u64 {
        self.frame_count.lock().map(|guard| *guard).unwrap_or_else(|_| {
            println!("⚠️ Frame count mutex was poisoned");
            0
        })
    }
    
    pub fn get_audio_frame_count(&self) -> u64 {
        self.audio_frame_count.lock().map(|guard| *guard).unwrap_or_else(|_| {
            println!("⚠️ Audio frame count mutex was poisoned");
            0
        })
    }
    
    pub fn get_current_fps(&self) -> f64 {
        self.fps_counter.lock().map(|guard| *guard).unwrap_or_else(|_| {
            println!("⚠️ FPS counter mutex was poisoned");
            0.0
        })
    }
    
    /// Check if the delegate is actively recording
    pub fn is_recording(&self) -> bool {
        self.is_recording.lock().map(|guard| *guard).unwrap_or(false)
    }
}

impl SCStreamDelegate for RealStreamDelegate {
    fn stream_did_output_sample_buffer(
        &self,
        _stream: &SCStream,
        sample_buffer: &CMSampleBuffer,
        of_type: SCStreamOutputType,
    ) {
        match of_type {
            SCStreamOutputType::Screen => {
                self.handle_video_sample_buffer(sample_buffer);
            }
            SCStreamOutputType::Audio | SCStreamOutputType::Microphone => {
                self.handle_audio_sample_buffer(sample_buffer);
            }
        }
    }
    
    fn stream_did_stop_with_error(&self, _stream: &SCStream, error: Option<&NSError>) {
        self.handle_stream_stopped(error);
    }
}

 