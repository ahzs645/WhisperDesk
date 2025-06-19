use std::ptr;
use objc2::runtime::AnyObject;
use objc2::{msg_send, sel, class};
use objc2_foundation::{NSString, NSURL, NSError, NSDictionary, NSNumber};
use objc2_av_foundation::{AVAssetWriter, AVAssetWriterInput, AVAssetWriterInputPixelBufferAdaptor};
use objc2_core_video::{CVPixelBuffer, kCVPixelFormatType_32BGRA};
use objc2_core_media::{CMTime, CMSampleBuffer, kCMTimeZero};
use napi::{Result, Status, Error};

// AVFoundation constants
pub const AVFileTypeQuickTimeMovie: &str = "com.apple.quicktime-movie";
pub const AVFileTypeMPEG4: &str = "public.mpeg-4";
pub const AVMediaTypeVideo: &str = "vide";
pub const AVMediaTypeAudio: &str = "soun";

// Video codec constants
pub const AVVideoCodecTypeH264: &str = "avc1";
pub const AVVideoCodecTypeHEVC: &str = "hvc1";

// Audio codec constants
pub const AVFormatIDKeyAAC: u32 = 0x61616320; // 'aac ' as u32

pub struct VideoEncoder {
    asset_writer: *mut AVAssetWriter,
    video_input: *mut AVAssetWriterInput,
    pixel_buffer_adaptor: *mut AVAssetWriterInputPixelBufferAdaptor,
    output_url: String,
    is_recording: bool,
    frame_count: u64,
    start_time: Option<CMTime>,
}

impl VideoEncoder {
    pub fn new(output_path: &str, width: u32, height: u32, fps: u32) -> Result<Self> {
        unsafe {
            // Create file URL
            let url_string = NSString::from_str(output_path);
            let file_url: *mut NSURL = msg_send![class!(NSURL), fileURLWithPath: &*url_string];
            
            // Create AVAssetWriter
            let mut error: *mut NSError = ptr::null_mut();
            let file_type = NSString::from_str(AVFileTypeMPEG4);
            let asset_writer: *mut AVAssetWriter = msg_send![
                class!(AVAssetWriter),
                assetWriterWithURL: file_url,
                fileType: &*file_type,
                error: &mut error
            ];
            
            if asset_writer.is_null() || !error.is_null() {
                return Err(Error::new(Status::GenericFailure, "Failed to create AVAssetWriter"));
            }
            
            // Create video input settings
            let video_settings = Self::create_video_settings(width, height, fps);
            let media_type = NSString::from_str(AVMediaTypeVideo);
            let video_input: *mut AVAssetWriterInput = msg_send![
                class!(AVAssetWriterInput),
                assetWriterInputWithMediaType: &*media_type,
                outputSettings: video_settings
            ];
            
            // Configure video input
            let _: () = msg_send![video_input, setExpectsMediaDataInRealTime: true];
            
            // Create pixel buffer adaptor
            let source_pixel_buffer_attributes = Self::create_pixel_buffer_attributes();
            let pixel_buffer_adaptor: *mut AVAssetWriterInputPixelBufferAdaptor = msg_send![
                class!(AVAssetWriterInputPixelBufferAdaptor),
                assetWriterInputPixelBufferAdaptorWithAssetWriterInput: video_input,
                sourcePixelBufferAttributes: source_pixel_buffer_attributes
            ];
            
            // Add input to writer
            let can_add: bool = msg_send![asset_writer, canAddInput: video_input];
            if can_add {
                let _: () = msg_send![asset_writer, addInput: video_input];
            } else {
                return Err(Error::new(Status::GenericFailure, "Cannot add video input"));
            }
            
            // Start writing session
            let started: bool = msg_send![asset_writer, startWriting];
            if !started {
                return Err(Error::new(Status::GenericFailure, "Failed to start writing"));
            }
            
            Ok(Self {
                asset_writer,
                video_input,
                pixel_buffer_adaptor,
                output_url: output_path.to_string(),
                is_recording: true,
                frame_count: 0,
                start_time: None,
            })
        }
    }
    
    pub fn encode_frame(&mut self, pixel_buffer: *mut CVPixelBuffer, presentation_time: CMTime) -> Result<()> {
        unsafe {
            if !self.is_recording {
                return Ok(());
            }
            
            // Set start time on first frame
            if self.start_time.is_none() {
                let _: () = msg_send![self.asset_writer, startSessionAtSourceTime: presentation_time];
                self.start_time = Some(presentation_time);
            }
            
            // Check if input is ready for more media data
            let ready: bool = msg_send![self.video_input, isReadyForMoreMediaData];
            if !ready {
                log::warn!("Video input not ready for more data");
                return Ok(());
            }
            
            // Calculate frame time based on frame count
            let frame_time = if let Some(start) = self.start_time {
                CMTime {
                    value: start.value + (self.frame_count as i64 * start.timescale as i64 / 30), // Assuming 30fps
                    timescale: start.timescale,
                    flags: start.flags,
                    epoch: start.epoch,
                }
            } else {
                presentation_time
            };
            
            // Append pixel buffer
            let success: bool = msg_send![
                self.pixel_buffer_adaptor,
                appendPixelBuffer: pixel_buffer,
                withPresentationTime: frame_time
            ];
            
            if !success {
                log::error!("Failed to append pixel buffer");
                return Err(Error::new(Status::GenericFailure, "Failed to encode frame"));
            }
            
            self.frame_count += 1;
            
            if self.frame_count % 30 == 0 {
                log::debug!("Encoded {} video frames", self.frame_count);
            }
            
            Ok(())
        }
    }
    
    pub fn finalize_encoding(&mut self) -> Result<String> {
        unsafe {
            if !self.is_recording {
                return Ok(self.output_url.clone());
            }
            
            self.is_recording = false;
            
            // Mark input as finished
            let _: () = msg_send![self.video_input, markAsFinished];
            
            // Finish writing
            let _: () = msg_send![self.asset_writer, finishWriting];
            
            log::info!("Video encoding finalized: {} ({} frames)", self.output_url, self.frame_count);
            Ok(self.output_url.clone())
        }
    }
    
    unsafe fn create_video_settings(width: u32, height: u32, fps: u32) -> *mut NSDictionary<NSString, AnyObject> {
        // Create video settings dictionary
        let codec_key = NSString::from_str("AVVideoCodecKey");
        let codec_value = NSString::from_str(AVVideoCodecTypeH264);
        
        let width_key = NSString::from_str("AVVideoWidthKey");
        let width_value: *mut NSNumber = msg_send![class!(NSNumber), numberWithUnsignedInt: width];
        
        let height_key = NSString::from_str("AVVideoHeightKey");
        let height_value: *mut NSNumber = msg_send![class!(NSNumber), numberWithUnsignedInt: height];
        
        // Create compression properties
        let compression_key = NSString::from_str("AVVideoCompressionPropertiesKey");
        let avg_bitrate_key = NSString::from_str("AVVideoAverageBitRateKey");
        let avg_bitrate_value: *mut NSNumber = msg_send![class!(NSNumber), numberWithUnsignedInt: width * height * 8]; // 8 bits per pixel
        
        let max_keyframe_key = NSString::from_str("AVVideoMaxKeyFrameIntervalKey");
        let max_keyframe_value: *mut NSNumber = msg_send![class!(NSNumber), numberWithUnsignedInt: fps * 2]; // Keyframe every 2 seconds
        
        // Create compression properties dictionary
        let compression_props: *mut NSDictionary<NSString, AnyObject> = msg_send![
            class!(NSDictionary),
            dictionaryWithObjects: &[avg_bitrate_value as *mut AnyObject, max_keyframe_value as *mut AnyObject],
            forKeys: &[&*avg_bitrate_key, &*max_keyframe_key],
            count: 2
        ];
        
        // Create main video settings dictionary
        let settings: *mut NSDictionary<NSString, AnyObject> = msg_send![
            class!(NSDictionary),
            dictionaryWithObjects: &[
                &*codec_value as *const NSString as *mut AnyObject,
                width_value as *mut AnyObject,
                height_value as *mut AnyObject,
                compression_props as *mut AnyObject
            ],
            forKeys: &[&*codec_key, &*width_key, &*height_key, &*compression_key],
            count: 4
        ];
        
        settings
    }
    
    unsafe fn create_pixel_buffer_attributes() -> *mut NSDictionary<NSString, AnyObject> {
        let pixel_format_key = NSString::from_str("kCVPixelBufferPixelFormatTypeKey");
        let pixel_format_value: *mut NSNumber = msg_send![
            class!(NSNumber), 
            numberWithUnsignedInt: kCVPixelFormatType_32BGRA
        ];
        
        let attributes: *mut NSDictionary<NSString, AnyObject> = msg_send![
            class!(NSDictionary),
            dictionaryWithObjects: &[pixel_format_value as *mut AnyObject],
            forKeys: &[&*pixel_format_key],
            count: 1
        ];
        
        attributes
    }
}

pub struct AudioEncoder {
    asset_writer: *mut AVAssetWriter,
    audio_input: *mut AVAssetWriterInput,
    output_url: String,
    is_recording: bool,
    sample_count: u64,
}

impl AudioEncoder {
    pub fn new(output_path: &str, sample_rate: u32, channels: u32) -> Result<Self> {
        unsafe {
            // Create file URL
            let url_string = NSString::from_str(output_path);
            let file_url: *mut NSURL = msg_send![class!(NSURL), fileURLWithPath: &*url_string];
            
            // Create AVAssetWriter
            let mut error: *mut NSError = ptr::null_mut();
            let file_type = NSString::from_str(AVFileTypeMPEG4);
            let asset_writer: *mut AVAssetWriter = msg_send![
                class!(AVAssetWriter),
                assetWriterWithURL: file_url,
                fileType: &*file_type,
                error: &mut error
            ];
            
            if asset_writer.is_null() || !error.is_null() {
                return Err(Error::new(Status::GenericFailure, "Failed to create audio AVAssetWriter"));
            }
            
            // Create audio input settings
            let audio_settings = Self::create_audio_settings(sample_rate, channels);
            let media_type = NSString::from_str(AVMediaTypeAudio);
            let audio_input: *mut AVAssetWriterInput = msg_send![
                class!(AVAssetWriterInput),
                assetWriterInputWithMediaType: &*media_type,
                outputSettings: audio_settings
            ];
            
            // Configure audio input
            let _: () = msg_send![audio_input, setExpectsMediaDataInRealTime: true];
            
            // Add input to writer
            let can_add: bool = msg_send![asset_writer, canAddInput: audio_input];
            if can_add {
                let _: () = msg_send![asset_writer, addInput: audio_input];
            } else {
                return Err(Error::new(Status::GenericFailure, "Cannot add audio input"));
            }
            
            // Start writing session
            let started: bool = msg_send![asset_writer, startWriting];
            if !started {
                return Err(Error::new(Status::GenericFailure, "Failed to start audio writing"));
            }
            
            let _: () = msg_send![asset_writer, startSessionAtSourceTime: kCMTimeZero];
            
            Ok(Self {
                asset_writer,
                audio_input,
                output_url: output_path.to_string(),
                is_recording: true,
                sample_count: 0,
            })
        }
    }
    
    pub fn encode_audio_buffer(&mut self, sample_buffer: &CMSampleBuffer) -> Result<()> {
        unsafe {
            if !self.is_recording {
                return Ok(());
            }
            
            // Check if input is ready for more media data
            let ready: bool = msg_send![self.audio_input, isReadyForMoreMediaData];
            if !ready {
                log::warn!("Audio input not ready for more data");
                return Ok(());
            }
            
            // Append sample buffer
            let success: bool = msg_send![self.audio_input, appendSampleBuffer: sample_buffer];
            
            if !success {
                log::error!("Failed to append audio sample buffer");
                return Err(Error::new(Status::GenericFailure, "Failed to encode audio"));
            }
            
            self.sample_count += 1;
            
            if self.sample_count % 100 == 0 {
                log::debug!("Encoded {} audio samples", self.sample_count);
            }
            
            Ok(())
        }
    }
    
    pub fn finalize_encoding(&mut self) -> Result<String> {
        unsafe {
            if !self.is_recording {
                return Ok(self.output_url.clone());
            }
            
            self.is_recording = false;
            
            // Mark input as finished
            let _: () = msg_send![self.audio_input, markAsFinished];
            
            // Finish writing
            let _: () = msg_send![self.asset_writer, finishWriting];
            
            log::info!("Audio encoding finalized: {} ({} samples)", self.output_url, self.sample_count);
            Ok(self.output_url.clone())
        }
    }
    
    unsafe fn create_audio_settings(sample_rate: u32, channels: u32) -> *mut NSDictionary<NSString, AnyObject> {
        let format_key = NSString::from_str("AVFormatIDKey");
        let format_value: *mut NSNumber = msg_send![class!(NSNumber), numberWithUnsignedInt: AVFormatIDKeyAAC];
        
        let sample_rate_key = NSString::from_str("AVSampleRateKey");
        let sample_rate_value: *mut NSNumber = msg_send![class!(NSNumber), numberWithFloat: sample_rate as f32];
        
        let channels_key = NSString::from_str("AVNumberOfChannelsKey");
        let channels_value: *mut NSNumber = msg_send![class!(NSNumber), numberWithUnsignedInt: channels];
        
        let bitrate_key = NSString::from_str("AVEncoderBitRateKey");
        let bitrate_value: *mut NSNumber = msg_send![class!(NSNumber), numberWithUnsignedInt: 128000u32]; // 128 kbps
        
        let settings: *mut NSDictionary<NSString, AnyObject> = msg_send![
            class!(NSDictionary),
            dictionaryWithObjects: &[
                format_value as *mut AnyObject,
                sample_rate_value as *mut AnyObject,
                channels_value as *mut AnyObject,
                bitrate_value as *mut AnyObject
            ],
            forKeys: &[&*format_key, &*sample_rate_key, &*channels_key, &*bitrate_key],
            count: 4
        ];
        
        settings
    }
} 