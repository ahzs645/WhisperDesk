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
}

impl RealStreamDelegate {
    pub fn new(output_path: String, is_recording: Arc<Mutex<bool>>, width: u32, height: u32, fps: u32) -> Self {
        // Create video encoder
        let video_encoder = VideoEncoder::new(&format!("{}_video.mp4", output_path), width, height, fps)
            .map(|encoder| Arc::new(Mutex::new(encoder)))
            .ok();
        
        // Create audio encoder
        let audio_encoder = AudioEncoder::new(&format!("{}_audio.mp4", output_path), 48000, 2)
            .map(|encoder| Arc::new(Mutex::new(encoder)))
            .ok();
        
        Self {
            output_path: output_path.clone(),
            is_recording,
            frame_count: Arc::new(Mutex::new(0)),
            audio_frame_count: Arc::new(Mutex::new(0)),
            video_encoder,
            audio_encoder,
        }
    }
    
    pub fn create_objc_delegate(&self) -> *mut AnyObject {
        unsafe {
            // For now, create a basic NSObject that can serve as delegate
            // In a full implementation, this would be a proper SCStreamDelegate
            let delegate: *mut AnyObject = msg_send![class!(NSObject), new];
            delegate
        }
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
        if let Some(error) = error {
            log::error!("Stream stopped with error: {:?}", error);
        } else {
            log::info!("Stream stopped successfully");
        }
        
        // Clean up resources
        if let Ok(mut is_recording) = self.is_recording.lock() {
            *is_recording = false;
        }
        
        // Finalize video and audio files
        if let Some(ref video_encoder) = self.video_encoder {
            if let Ok(mut encoder) = video_encoder.lock() {
                let _ = encoder.finalize_encoding();
            }
        }
        if let Some(ref audio_encoder) = self.audio_encoder {
            if let Ok(mut encoder) = audio_encoder.lock() {
                let _ = encoder.finalize_encoding();
            }
        }
    }
}

impl RealStreamDelegate {
    pub fn handle_sample_buffer(&self, sample_buffer: &CMSampleBuffer, output_type: SCStreamOutputType) {
        match output_type {
            SCStreamOutputType::Screen => {
                if let Some(ref encoder) = self.video_encoder {
                    self.process_video_sample_buffer(sample_buffer, encoder);
                }
            }
            SCStreamOutputType::Audio | SCStreamOutputType::Microphone => {
                if let Some(ref encoder) = self.audio_encoder {
                    self.process_audio_sample_buffer(sample_buffer, encoder);
                }
            }
        }
    }
    
    pub fn handle_stream_stopped(&self, error: Option<&NSError>) {
        if let Some(error) = error {
            log::error!("Stream stopped with error: {:?}", error);
        } else {
            log::info!("Stream stopped successfully");
        }
        
        if let Ok(mut is_recording) = self.is_recording.lock() {
            *is_recording = false;
        }
    }
    
    fn process_video_sample_buffer(&self, sample_buffer: &CMSampleBuffer, encoder: &Arc<Mutex<VideoEncoder>>) {
        unsafe {
            // Get CVPixelBuffer from CMSampleBuffer
            let image_buffer: *mut CVImageBuffer = msg_send![sample_buffer, imageBuffer];
            if image_buffer.is_null() {
                return;
            }
            
            let pixel_buffer = image_buffer as *mut CVPixelBuffer;
            
            // Get presentation time
            let presentation_time: CMTime = msg_send![sample_buffer, presentationTimeStamp];
            
            // Encode the frame
            if let Ok(mut video_encoder) = encoder.lock() {
                if let Err(e) = video_encoder.encode_frame(pixel_buffer, presentation_time) {
                    log::error!("Failed to encode video frame: {}", e);
                }
            }
            
            // Update frame count
            if let Ok(mut count) = self.frame_count.lock() {
                *count += 1;
                if *count % 30 == 0 {
                    log::debug!("Encoded {} video frames", *count);
                }
            }
        }
    }
    
    fn handle_video_sample_buffer(&self, sample_buffer: &CMSampleBuffer) {
        if let Some(ref encoder) = self.video_encoder {
            self.process_video_sample_buffer(sample_buffer, encoder);
        }
    }
    
    fn process_audio_sample_buffer(&self, sample_buffer: &CMSampleBuffer, encoder: &Arc<Mutex<AudioEncoder>>) {
        // Encode the audio buffer directly
        if let Ok(mut audio_encoder) = encoder.lock() {
            if let Err(e) = audio_encoder.encode_audio_buffer(sample_buffer) {
                log::error!("Failed to encode audio buffer: {}", e);
            }
        }
        
        // Update audio frame count
        if let Ok(mut count) = self.audio_frame_count.lock() {
            *count += 1;
            if *count % 100 == 0 {
                log::debug!("Encoded {} audio samples", *count);
            }
        }
    }
    
    fn handle_audio_sample_buffer(&self, sample_buffer: &CMSampleBuffer) {
        if let Some(ref encoder) = self.audio_encoder {
            self.process_audio_sample_buffer(sample_buffer, encoder);
        }
    }
    

    
    pub fn get_output_path(&self) -> String {
        self.output_path.clone()
    }
    
    pub fn get_frame_count(&self) -> u64 {
        self.frame_count.lock().map(|guard| *guard).unwrap_or_else(|_| {
            log::warn!("Frame count mutex was poisoned");
            0
        })
    }
    
    pub fn get_audio_frame_count(&self) -> u64 {
        self.audio_frame_count.lock().map(|guard| *guard).unwrap_or_else(|_| {
            log::warn!("Audio frame count mutex was poisoned");
            0
        })
    }
}

 