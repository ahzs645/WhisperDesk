use crate::AudioDevice;
use napi::bindgen_prelude::*;
use objc2::{msg_send, class};
use objc2_foundation::{NSArray, NSString};
use std::ptr;

pub struct AudioManager;

impl AudioManager {
    pub fn get_available_audio_devices() -> Result<Vec<AudioDevice>> {
        println!("🔊 Getting available audio devices via AVFoundation");
        
        let mut devices = Vec::new();
        
        unsafe {
            // Get AVAudioSession
            let session_class = class!(AVAudioSession);
            let shared_instance: *mut objc2::runtime::AnyObject = msg_send![session_class, sharedInstance];
            
            if shared_instance.is_null() {
                return Err(Error::new(Status::GenericFailure, "Failed to get AVAudioSession"));
            }
            
            // Get available inputs
            let available_inputs: *mut NSArray = msg_send![shared_instance, availableInputs];
            if !available_inputs.is_null() {
                let inputs_array = &*available_inputs;
                let count = inputs_array.count();
                
                for i in 0..count {
                    let input: *mut objc2::runtime::AnyObject = msg_send![inputs_array, objectAtIndex: i];
                    if !input.is_null() {
                        let port_name: *mut NSString = msg_send![input, portName];
                        let uid: *mut NSString = msg_send![input, UID];
                        
                        if !port_name.is_null() && !uid.is_null() {
                            let name_str = (*port_name).to_string();
                            let uid_str = (*uid).to_string();
                            
                            devices.push(AudioDevice {
                                id: uid_str,
                                name: name_str,
                                device_type: "microphone".to_string(),
                            });
                        }
                    }
                }
            }
            
            // Get available outputs from current route
            let current_route: *mut objc2::runtime::AnyObject = msg_send![shared_instance, currentRoute];
            if !current_route.is_null() {
                let outputs: *mut NSArray = msg_send![current_route, outputs];
                if !outputs.is_null() {
                    let outputs_array = &*outputs;
                    let count = outputs_array.count();
                    
                    for i in 0..count {
                        let output: *mut objc2::runtime::AnyObject = msg_send![outputs_array, objectAtIndex: i];
                        if !output.is_null() {
                            let port_name: *mut NSString = msg_send![output, portName];
                            let uid: *mut NSString = msg_send![output, UID];
                            
                            if !port_name.is_null() && !uid.is_null() {
                                let name_str = (*port_name).to_string();
                                let uid_str = (*uid).to_string();
                                
                                devices.push(AudioDevice {
                                    id: uid_str,
                                    name: name_str,
                                    device_type: "speaker".to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }
        
        // If no devices found via API, log the issue but don't add mock devices
        if devices.is_empty() {
            println!("⚠️ No audio devices found via AVFoundation - this may indicate a permissions issue");
            return Err(Error::new(Status::GenericFailure, "No audio devices available. Check microphone permissions."));
        }
        
        println!("✅ Found {} real audio devices", devices.len());
        Ok(devices)
    }
    
    pub fn get_preferred_microphone_device() -> Option<String> {
        // Try to get the preferred device from AVAudioSession
        unsafe {
            let session_class = class!(AVAudioSession);
            let shared_instance: *mut objc2::runtime::AnyObject = msg_send![session_class, sharedInstance];
            
            if !shared_instance.is_null() {
                // Get preferred input
                let preferred_input: *mut objc2::runtime::AnyObject = msg_send![shared_instance, preferredInput];
                if !preferred_input.is_null() {
                    let uid: *mut NSString = msg_send![preferred_input, UID];
                    if !uid.is_null() {
                        return Some((*uid).to_string());
                    }
                }
                
                // Fallback to built-in microphone
                let available_inputs: *mut NSArray = msg_send![shared_instance, availableInputs];
                if !available_inputs.is_null() {
                    let inputs_array = &*available_inputs;
                    let count = inputs_array.count();
                    
                    for i in 0..count {
                        let input: *mut objc2::runtime::AnyObject = msg_send![inputs_array, objectAtIndex: i];
                        if !input.is_null() {
                            let port_name: *mut NSString = msg_send![input, portName];
                            if !port_name.is_null() {
                                let name_str = (*port_name).to_string();
                                if name_str.contains("Built-in") || name_str.contains("BuiltInMicrophoneDevice") {
                                    let uid: *mut NSString = msg_send![input, UID];
                                    if !uid.is_null() {
                                        return Some((*uid).to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Final fallback
        Some("builtin-mic".to_string())
    }
    
    pub fn configure_audio_session() -> Result<()> {
        println!("🔧 Configuring real audio session for recording");
        
        unsafe {
            let session_class = class!(AVAudioSession);
            let shared_instance: *mut objc2::runtime::AnyObject = msg_send![session_class, sharedInstance];
            
            if shared_instance.is_null() {
                return Err(Error::new(Status::GenericFailure, "Failed to get AVAudioSession"));
            }
            
            // Set category for recording
            let category = NSString::from_str("AVAudioSessionCategoryPlayAndRecord");
            let mut error: *mut objc2::runtime::AnyObject = ptr::null_mut();
            let success: bool = msg_send![
                shared_instance, 
                setCategory: &*category,
                error: &mut error
            ];
            
            if !success {
                return Err(Error::new(Status::GenericFailure, "Failed to set audio session category"));
            }
            
            // Set active
            let mut error: *mut objc2::runtime::AnyObject = ptr::null_mut();
            let success: bool = msg_send![
                shared_instance, 
                setActive: true,
                error: &mut error
            ];
            
            if !success {
                return Err(Error::new(Status::GenericFailure, "Failed to activate audio session"));
            }
        }
        
        println!("✅ Real audio session configured");
        Ok(())
    }
} 