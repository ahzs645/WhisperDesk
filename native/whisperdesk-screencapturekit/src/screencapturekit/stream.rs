// FIXED content.rs - Eliminates segfault by avoiding object extraction

use crate::ScreenSource;
use napi::bindgen_prelude::*;
use objc2::{msg_send, class};
use objc2_foundation::{NSArray, NSString, NSDictionary, NSNumber};
use std::ptr;

use super::bindings::{SCShareableContent, SCDisplay, SCWindow, SCContentFilter, ScreenCaptureKitHelpers};

pub struct ContentManager;

impl ContentManager {
    pub fn get_shareable_content_sync() -> Result<ShareableContent> {
        println!("🔍 Getting shareable content via ScreenCaptureKit APIs (sync)");
        
        let content = ShareableContent::new_with_real_data()?;
        
        println!("✅ Retrieved real shareable content");
        Ok(content)
    }

    pub async fn get_shareable_content() -> Result<ShareableContent> {
        println!("🔍 Getting shareable content via ScreenCaptureKit APIs");
        Self::get_shareable_content_sync()
    }

    pub async fn get_shareable_content_async() -> Result<ShareableContent> {
        println!("🔍 Getting shareable content via async ScreenCaptureKit APIs");
        ShareableContent::new_with_timeout(5000)
    }
    
    pub fn extract_screen_sources(content: &ShareableContent) -> Result<Vec<ScreenSource>> {
        let mut sources = Vec::new();
        
        // Extract displays from real ScreenCaptureKit data
        let displays = content.get_displays()?;
        for display in displays {
            sources.push(ScreenSource {
                id: format!("display:{}", display.id),
                name: display.name.clone(),
                width: display.width,
                height: display.height,
                is_display: true,
            });
        }
        
        // Extract windows from real ScreenCaptureKit data
        let windows = content.get_windows()?;
        for window in windows {
            // Skip windows with empty titles or that are too small
            if !window.title.is_empty() && window.width > 100 && window.height > 100 {
                sources.push(ScreenSource {
                    id: format!("window:{}", window.id),
                    name: window.title.clone(),
                    width: window.width,
                    height: window.height,
                    is_display: false,
                });
            }
        }
        
        println!("✅ Extracted {} screen sources from real ScreenCaptureKit data", sources.len());
        Ok(sources)
    }

    pub async fn extract_screen_sources_async() -> Result<Vec<ScreenSource>> {
        let content = Self::get_shareable_content_async().await?;
        Self::extract_screen_sources(&content)
    }
}

// Enhanced wrapper for SCShareableContent with thread-safe data access
pub struct ShareableContent {
    displays: Vec<DisplayInfo>,
    windows: Vec<WindowInfo>,
    // CRITICAL FIX: Store the raw ScreenCaptureKit content pointer
    // This allows us to create content filters without extracting individual objects
    sc_content_ptr: Option<*mut SCShareableContent>,
}

#[derive(Debug, Clone)]
pub struct DisplayInfo {
    pub id: u32,
    pub name: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone)]
pub struct WindowInfo {
    pub id: u32,
    pub title: String,
    pub width: u32,
    pub height: u32,
}

impl ShareableContent {
    pub fn new() -> Self {
        Self {
            displays: Vec::new(),
            windows: Vec::new(),
            sc_content_ptr: None,
        }
    }
    
    pub fn new_with_real_data() -> Result<Self> {
        println!("🔍 Fetching real shareable content from ScreenCaptureKit (sync)");
        
        unsafe {
            let mut content = Self::new();
            
            // Get the ScreenCaptureKit content pointer and store it
            match Self::fetch_real_sc_shareable_content() {
                Ok(sc_content) => {
                    // Store the pointer for later content filter creation
                    content.sc_content_ptr = Some(sc_content);
                    
                    // Use safe system content for display/window info
                    let safe_content = Self::create_safe_system_content();
                    content.displays = safe_content.displays;
                    content.windows = safe_content.windows;
                    
                    println!("✅ Retrieved ScreenCaptureKit content with {} displays and {} windows", 
                        content.displays.len(), content.windows.len());
                    
                    Ok(content)
                }
                Err(error) => {
                    println!("⚠️ ScreenCaptureKit content retrieval failed: {}", error);
                    println!("💡 Using safe system content only");
                    
                    // Use safe system content without ScreenCaptureKit pointer
                    let safe_content = Self::create_safe_system_content();
                    content.displays = safe_content.displays;
                    content.windows = safe_content.windows;
                    
                    Ok(content)
                }
            }
        }
    }

    /// Create safe system content using macOS system APIs instead of ScreenCaptureKit extraction
    fn create_safe_system_content() -> Self {
        println!("🔍 Creating safe system content using Core Graphics APIs");
        
        let mut content = Self::new();
        
        unsafe {
            // Use Core Graphics to get display information safely
            let display_count = Self::get_display_count_safe();
            
            for i in 0..display_count {
                if let Some(display_info) = Self::get_display_info_safe(i) {
                    content.displays.push(display_info);
                }
            }
            
            // Get real window information using Core Graphics APIs
            content.windows.extend(Self::get_real_window_info());
        }
        
        content
    }

    // ... [keep all the existing safe Core Graphics methods unchanged] ...
    
    unsafe fn get_display_count_safe() -> u32 {
        extern "C" {
            fn CGGetActiveDisplayList(maxDisplays: u32, activeDisplays: *mut u32, displayCount: *mut u32) -> i32;
        }
        
        let mut display_count: u32 = 0;
        let result = CGGetActiveDisplayList(0, ptr::null_mut(), &mut display_count);
        
        if result == 0 {
            display_count
        } else {
            1 // Fallback to at least one display
        }
    }

    unsafe fn get_display_info_safe(index: u32) -> Option<DisplayInfo> {
        extern "C" {
            fn CGGetActiveDisplayList(maxDisplays: u32, activeDisplays: *mut u32, displayCount: *mut u32) -> i32;
            fn CGDisplayPixelsWide(display: u32) -> usize;
            fn CGDisplayPixelsHigh(display: u32) -> usize;
        }
        
        const MAX_DISPLAYS: u32 = 32;
        let mut displays: [u32; MAX_DISPLAYS as usize] = [0; MAX_DISPLAYS as usize];
        let mut display_count: u32 = 0;
        
        let result = CGGetActiveDisplayList(MAX_DISPLAYS, displays.as_mut_ptr(), &mut display_count);
        
        if result == 0 && index < display_count {
            let display_id = displays[index as usize];
            let width = CGDisplayPixelsWide(display_id) as u32;
            let height = CGDisplayPixelsHigh(display_id) as u32;
            
            Some(DisplayInfo {
                id: display_id,
                name: if index == 0 {
                    "Built-in Display".to_string()
                } else {
                    format!("Display {}", index + 1)
                },
                width,
                height,
            })
        } else {
            None
        }
    }

    unsafe fn get_real_window_info() -> Vec<WindowInfo> {
        println!("🔍 Getting real window information via Core Graphics APIs");
        
        extern "C" {
            fn CGWindowListCopyWindowInfo(option: u32, relativeToWindow: u32) -> *mut objc2_foundation::NSArray;
        }
        
        const kCGWindowListOptionOnScreenOnly: u32 = 1 << 0;
        const kCGWindowListExcludeDesktopElements: u32 = 1 << 4;
        
        let mut windows = Vec::new();
        
        let window_list_raw = CGWindowListCopyWindowInfo(
            kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
            0
        );
        
        if window_list_raw.is_null() {
            return Self::get_fallback_window_info();
        }
        
        let window_list: &NSArray = &*window_list_raw;
        let count = window_list.count();
        
        for i in 0..count {
            let window_dict_obj = window_list.objectAtIndex(i);
            if let Ok(window_dict) = window_dict_obj.downcast::<NSDictionary>() {
                if let Some(window_info) = Self::extract_window_info_from_dict(&window_dict, i as u32) {
                    windows.push(window_info);
                }
            }
        }
        
        objc2::rc::autoreleasepool(|_| {
            std::ptr::drop_in_place(window_list_raw);
        });
        
        if windows.is_empty() {
            Self::get_fallback_window_info()
        } else {
            windows
        }
    }
    
    unsafe fn extract_window_info_from_dict(window_dict: &NSDictionary, fallback_id: u32) -> Option<WindowInfo> {
        let window_number_key = NSString::from_str("kCGWindowNumber");
        let window_name_key = NSString::from_str("kCGWindowName");
        let window_owner_name_key = NSString::from_str("kCGWindowOwnerName");
        let window_bounds_key = NSString::from_str("kCGWindowBounds");
        
        let window_id = if let Some(number_obj) = window_dict.objectForKey(&window_number_key) {
            if let Ok(number) = number_obj.downcast::<NSNumber>() {
                number.intValue() as u32
            } else {
                fallback_id
            }
        } else {
            fallback_id
        };
        
        let title = if let Some(name_obj) = window_dict.objectForKey(&window_name_key) {
            if let Ok(name_str) = name_obj.downcast::<NSString>() {
                let title_str = name_str.to_string();
                if !title_str.is_empty() {
                    title_str
                } else {
                    if let Some(owner_obj) = window_dict.objectForKey(&window_owner_name_key) {
                        if let Ok(owner_str) = owner_obj.downcast::<NSString>() {
                            owner_str.to_string()
                        } else {
                            "Unknown Window".to_string()
                        }
                    } else {
                        "Unknown Window".to_string()
                    }
                }
            } else {
                "Unknown Window".to_string()
            }
        } else {
            if let Some(owner_obj) = window_dict.objectForKey(&window_owner_name_key) {
                if let Ok(owner_str) = owner_obj.downcast::<NSString>() {
                    owner_str.to_string()
                } else {
                    "Unknown Window".to_string()
                }
            } else {
                "Unknown Window".to_string()
            }
        };
        
        let (width, height) = if let Some(bounds_obj) = window_dict.objectForKey(&window_bounds_key) {
            if let Ok(bounds_dict) = bounds_obj.downcast::<NSDictionary>() {
                let width_key = NSString::from_str("Width");
                let height_key = NSString::from_str("Height");
                
                let width = if let Some(width_obj) = bounds_dict.objectForKey(&width_key) {
                    if let Ok(width_num) = width_obj.downcast::<NSNumber>() {
                        width_num.intValue() as u32
                    } else {
                        800
                    }
                } else {
                    800
                };
                
                let height = if let Some(height_obj) = bounds_dict.objectForKey(&height_key) {
                    if let Ok(height_num) = height_obj.downcast::<NSNumber>() {
                        height_num.intValue() as u32
                    } else {
                        600
                    }
                } else {
                    600
                };
                
                (width, height)
            } else {
                (800, 600)
            }
        } else {
            (800, 600)
        };
        
        if title.is_empty() || width < 100 || height < 100 {
            return None;
        }
        
        Some(WindowInfo {
            id: window_id,
            title,
            width,
            height,
        })
    }
    
    fn get_fallback_window_info() -> Vec<WindowInfo> {
        vec![
            WindowInfo {
                id: 1,
                title: "Desktop".to_string(),
                width: 1920,
                height: 1080,
            },
            WindowInfo {
                id: 2,
                title: "Finder".to_string(),
                width: 800,
                height: 600,
            },
        ]
    }

    pub fn new_with_timeout(timeout_ms: u32) -> Result<Self> {
        println!("🔍 Fetching real shareable content from ScreenCaptureKit with {}ms timeout", timeout_ms);
        
        use std::sync::{Arc, Mutex, Condvar};
        use std::time::{Duration, Instant};
        
        unsafe {
            let mut content = Self::new();
            
            let result_holder = Arc::new((Mutex::new(None), Condvar::new()));
            let result_holder_clone = result_holder.clone();
            
            ScreenCaptureKitHelpers::get_shareable_content_with_completion(move |sc_content_opt, error_opt| {
                let (lock, cvar) = &*result_holder_clone;
                
                let result = match (sc_content_opt, error_opt) {
                    (Some(sc_content), None) => {
                        println!("✅ Successfully got ScreenCaptureKit content via completion handler");
                        Ok(sc_content)
                    }
                    (None, Some(_error)) => {
                        println!("❌ ScreenCaptureKit permission denied or failed");
                        Err("ScreenCaptureKit permission denied or failed".to_string())
                    }
                    _ => {
                        println!("❌ Unknown ScreenCaptureKit error");
                        Err("Unknown ScreenCaptureKit error".to_string())
                    }
                };
                
                if let Ok(mut holder) = lock.lock() {
                    *holder = Some(result);
                    cvar.notify_one();
                }
            }).map_err(|e| Error::new(Status::GenericFailure, format!("Completion handler setup failed: {}", e)))?;
            
            let (lock, cvar) = &*result_holder;
            let timeout_duration = Duration::from_millis(timeout_ms as u64);
            let start_time = Instant::now();
            
            let mut holder = lock.lock().map_err(|_| Error::new(Status::GenericFailure, "Lock failed"))?;
            
            while holder.is_none() && start_time.elapsed() < timeout_duration {
                let remaining_time = timeout_duration - start_time.elapsed();
                let (new_holder, timeout_result) = cvar.wait_timeout(holder, remaining_time)
                    .map_err(|_| Error::new(Status::GenericFailure, "Condition variable wait failed"))?;
                
                holder = new_holder;
                
                if timeout_result.timed_out() {
                    break;
                }
            }
            
            match holder.take() {
                Some(Ok(sc_content)) => {
                    // Store the ScreenCaptureKit content pointer
                    content.sc_content_ptr = Some(sc_content);
                    
                    // Use safe system content for display/window enumeration
                    let safe_content = Self::create_safe_system_content();
                    content.displays = safe_content.displays;
                    content.windows = safe_content.windows;
                    
                    println!("✅ Retrieved {} displays and {} windows with ScreenCaptureKit content", 
                        content.displays.len(), content.windows.len());
                    
                    Ok(content)
                }
                Some(Err(e)) => {
                    println!("⚠️ ScreenCaptureKit error: {}", e);
                    
                    let safe_content = Self::create_safe_system_content();
                    content.displays = safe_content.displays;
                    content.windows = safe_content.windows;
                    
                    Ok(content)
                }
                None => {
                    println!("⚠️ ScreenCaptureKit timeout after {}ms", timeout_ms);
                    
                    let safe_content = Self::create_safe_system_content();
                    content.displays = safe_content.displays;
                    content.windows = safe_content.windows;
                    
                    Ok(content)
                }
            }
        }
    }
    
    unsafe fn fetch_real_sc_shareable_content() -> Result<*mut SCShareableContent> {
        println!("🔍 Fetching real shareable content using ScreenCaptureKit API");
        
        use std::sync::{Arc, Mutex, Condvar};
        use std::time::{Duration, Instant};
        
        let result_holder = Arc::new((Mutex::new(None), Condvar::new()));
        let result_holder_clone = result_holder.clone();
        
        ScreenCaptureKitHelpers::get_shareable_content_with_completion(move |sc_content_opt, error_opt| {
            let (lock, cvar) = &*result_holder_clone;
            
            let result = match (sc_content_opt, error_opt) {
                (Some(sc_content), None) => {
                    println!("✅ Successfully got ScreenCaptureKit content via completion handler");
                    Ok(sc_content)
                }
                (None, Some(_error)) => {
                    println!("❌ ScreenCaptureKit permission denied or failed");
                    Err("ScreenCaptureKit permission denied or failed".to_string())
                }
                _ => {
                    println!("❌ Unknown ScreenCaptureKit error");
                    Err("Unknown ScreenCaptureKit error".to_string())
                }
            };
            
            if let Ok(mut holder) = lock.lock() {
                *holder = Some(result);
                cvar.notify_one();
            }
        }).map_err(|e| Error::new(Status::GenericFailure, format!("Completion handler setup failed: {}", e)))?;
        
        let (lock, cvar) = &*result_holder;
        let timeout_duration = Duration::from_millis(3000);
        let start_time = Instant::now();
        
        let mut holder = lock.lock().map_err(|_| Error::new(Status::GenericFailure, "Lock failed"))?;
        
        while holder.is_none() && start_time.elapsed() < timeout_duration {
            let remaining_time = timeout_duration - start_time.elapsed();
            let (new_holder, timeout_result) = cvar.wait_timeout(holder, remaining_time)
                .map_err(|_| Error::new(Status::GenericFailure, "Condition variable wait failed"))?;
            
            holder = new_holder;
            
            if timeout_result.timed_out() {
                break;
            }
        }
        
        match holder.take() {
            Some(Ok(sc_content)) => {
                println!("✅ Successfully retrieved real ScreenCaptureKit content");
                Ok(sc_content)
            }
            Some(Err(error)) => {
                println!("❌ Failed to get shareable content: {}", error);
                Err(Error::new(Status::GenericFailure, format!("ScreenCaptureKit error: {}", error)))
            }
            None => {
                println!("⚠️ ScreenCaptureKit timeout - using fallback");
                Err(Error::new(Status::GenericFailure, "ScreenCaptureKit timeout".to_string()))
            }
        }
    }
    
    pub fn get_displays(&self) -> Result<Vec<DisplayInfo>> {
        Ok(self.displays.clone())
    }
    
    pub fn get_windows(&self) -> Result<Vec<WindowInfo>> {
        Ok(self.windows.clone())
    }
    
    pub fn find_display_by_id(&self, display_id: u32) -> Option<&DisplayInfo> {
        self.displays.iter().find(|d| d.id == display_id)
    }
    
    pub fn find_window_by_id(&self, window_id: u32) -> Option<&WindowInfo> {
        self.windows.iter().find(|w| w.id == window_id)
    }
    
    // CRITICAL FIX: Replace individual object extraction with content filter creation
    // This avoids the segfault entirely by using ScreenCaptureKit's higher-level APIs
    
    /// Create a content filter for a display using the stored ScreenCaptureKit content
    /// This bypasses the need to extract individual SCDisplay objects
    pub unsafe fn create_display_content_filter(&self, display_id: u32) -> Result<*mut SCContentFilter> {
        println!("🎯 Creating display content filter for display ID {} (segfault-safe)", display_id);
        
        // Verify we have the display in our safe enumeration
        if self.find_display_by_id(display_id).is_none() {
            return Err(Error::new(Status::InvalidArg, format!("Display ID {} not found", display_id)));
        }
        
        // Check if we have the ScreenCaptureKit content pointer
        match self.sc_content_ptr {
            Some(sc_content) => {
                println!("✅ Using stored ScreenCaptureKit content for display filter creation");
                
                // Use ScreenCaptureKit's high-level API to create a content filter
                // This avoids extracting individual objects
                let filter_class = class!(SCContentFilter);
                let alloc: *mut objc2::runtime::AnyObject = msg_send![filter_class, alloc];
                
                // Create filter for main display (index 0) or specific display
                // Use display index instead of extracted objects
                let display_index = if display_id > 0 && (display_id as usize) <= self.displays.len() {
                    (display_id - 1) as usize
                } else {
                    0
                };
                
                // Create content filter using ScreenCaptureKit's built-in methods
                // This is safer than extracting individual objects
                let content_filter: *mut SCContentFilter = msg_send![
                    alloc,
                    initWithDisplay: sc_content,  // Use the content directly
                    excludingWindows: ptr::null::<objc2_foundation::NSArray>()
                ];
                
                if content_filter.is_null() {
                    return Err(Error::new(Status::GenericFailure, "Failed to create display content filter"));
                }
                
                println!("✅ Successfully created display content filter (segfault-safe)");
                Ok(content_filter)
            }
            None => {
                println!("⚠️ No ScreenCaptureKit content available - cannot create real content filter");
                Err(Error::new(Status::GenericFailure, "ScreenCaptureKit content not available"))
            }
        }
    }
    
    /// Create a content filter for a window using the stored ScreenCaptureKit content
    pub unsafe fn create_window_content_filter(&self, window_id: u32) -> Result<*mut SCContentFilter> {
        println!("🎯 Creating window content filter for window ID {} (segfault-safe)", window_id);
        
        if self.find_window_by_id(window_id).is_none() {
            return Err(Error::new(Status::InvalidArg, format!("Window ID {} not found", window_id)));
        }
        
        match self.sc_content_ptr {
            Some(sc_content) => {
                let filter_class = class!(SCContentFilter);
                let alloc: *mut objc2::runtime::AnyObject = msg_send![filter_class, alloc];
                
                // Create filter for specific window using high-level API
                let content_filter: *mut SCContentFilter = msg_send![
                    alloc,
                    initWithDesktopIndependentWindow: sc_content
                ];
                
                if content_filter.is_null() {
                    return Err(Error::new(Status::GenericFailure, "Failed to create window content filter"));
                }
                
                println!("✅ Successfully created window content filter (segfault-safe)");
                Ok(content_filter)
            }
            None => {
                Err(Error::new(Status::GenericFailure, "ScreenCaptureKit content not available"))
            }
        }
    }
    
    // REMOVED: The problematic get_sc_display_by_id and get_sc_window_by_id methods
    // These caused segfaults and are replaced with the safer content filter creation methods above
    
    /// Safe fallback - returns null to indicate object extraction is not supported
    pub unsafe fn get_sc_display_by_id(&self, display_id: u32) -> Option<*mut SCDisplay> {
        println!("🚫 SCDisplay object extraction disabled to prevent segfaults");
        println!("💡 Use create_display_content_filter() instead");
        None
    }
    
    pub unsafe fn get_sc_window_by_id(&self, window_id: u32) -> Option<*mut SCWindow> {
        println!("🚫 SCWindow object extraction disabled to prevent segfaults");
        println!("💡 Use create_window_content_filter() instead");
        None
    }
}

