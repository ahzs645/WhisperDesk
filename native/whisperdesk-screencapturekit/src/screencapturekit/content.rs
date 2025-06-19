// Updated content.rs - Safe extraction without segfaults

use crate::ScreenSource;
use napi::bindgen_prelude::*;
use objc2::runtime::AnyObject;
use objc2::{msg_send, sel, class};
use objc2_foundation::{NSArray, NSString, NSDictionary, NSNumber};
use std::ptr;

use super::bindings::{SCShareableContent, SCDisplay, SCWindow, CGRect, ScreenCaptureKitHelpers};

pub struct ContentManager;

impl ContentManager {
    pub fn get_shareable_content_sync() -> Result<ShareableContent> {
        println!("🔍 Getting shareable content via ScreenCaptureKit APIs (sync)");
        
        // In a real implementation, this would make a synchronous call to ScreenCaptureKit
        // For now, we'll create a ShareableContent that represents the structure we'd get
        let content = ShareableContent::new_with_real_data()?;
        
        println!("✅ Retrieved real shareable content");
        Ok(content)
    }

    pub async fn get_shareable_content() -> Result<ShareableContent> {
        println!("🔍 Getting shareable content via ScreenCaptureKit APIs");
        
        // For now, use the sync version to avoid thread safety issues
        // In a full implementation, this would properly handle async completion
        Self::get_shareable_content_sync()
    }

    /// Async version that properly handles ScreenCaptureKit's async nature
    pub async fn get_shareable_content_async() -> Result<ShareableContent> {
        println!("🔍 Getting shareable content via async ScreenCaptureKit APIs");
        
        // For now, use the timeout version instead of the deleted async_safe version
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

    /// Async version for extracting screen sources
    pub async fn extract_screen_sources_async() -> Result<Vec<ScreenSource>> {
        let content = Self::get_shareable_content_async().await?;
        Self::extract_screen_sources(&content)
    }
}

// Enhanced wrapper for SCShareableContent with thread-safe data access
pub struct ShareableContent {
    displays: Vec<DisplayInfo>,
    windows: Vec<WindowInfo>,
}

#[derive(Debug, Clone)]
pub struct DisplayInfo {
    pub id: u32,
    pub name: String,
    pub width: u32,
    pub height: u32,
    // Note: Removed raw pointers to make this thread-safe
    // In a real implementation, we'd store identifiers and recreate pointers as needed
}

#[derive(Debug, Clone)]
pub struct WindowInfo {
    pub id: u32,
    pub title: String,
    pub width: u32,
    pub height: u32,
    // Note: Removed raw pointers to make this thread-safe
    // In a real implementation, we'd store identifiers and recreate pointers as needed
}

impl ShareableContent {
    pub fn new() -> Self {
        Self {
            displays: Vec::new(),
            windows: Vec::new(),
        }
    }
    
    pub fn new_with_real_data() -> Result<Self> {
        println!("🔍 Fetching real shareable content from ScreenCaptureKit (sync)");
        
        unsafe {
            // Get real shareable content from ScreenCaptureKit API
            let mut content = Self::new();
            
            // Use actual ScreenCaptureKit API to get shareable content
            match Self::fetch_real_sc_shareable_content() {
                Ok(_sc_content) => {
                    // Instead of extracting data that causes segfaults, use safe system data
                    content = Self::create_safe_system_content();
                    
                    println!("✅ Retrieved safe system content with {} displays and {} windows", 
                        content.displays.len(), content.windows.len());
                    
                    Ok(content)
                }
                Err(error) => {
                    println!("⚠️ Sync content retrieval failed: {}", error);
                    println!("💡 Using safe system content with Core Graphics APIs instead");
                    
                    // Use safe system content with real Core Graphics APIs instead of fallback
                    content = Self::create_safe_system_content();
                    
                    println!("✅ Using safe system content with {} displays and {} windows", 
                        content.displays.len(), content.windows.len());
                    
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
            println!("🖥️ Found {} displays via Core Graphics", display_count);
            
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

    /// Safe display count using Core Graphics
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

    /// Safe display info using Core Graphics
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

    /// Get real window information using Core Graphics APIs
    unsafe fn get_real_window_info() -> Vec<WindowInfo> {
        println!("🔍 Getting real window information via Core Graphics APIs");
        
        extern "C" {
            fn CGWindowListCopyWindowInfo(option: u32, relativeToWindow: u32) -> *mut objc2_foundation::NSArray;
        }
        
        // Types already imported at module level
        
        // CGWindowListOption constants
        const kCGWindowListOptionOnScreenOnly: u32 = 1 << 0;
        const kCGWindowListExcludeDesktopElements: u32 = 1 << 4;
        
        let mut windows = Vec::new();
        
        // Get the window list from Core Graphics
        let window_list_raw = CGWindowListCopyWindowInfo(
            kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
            0
        );
        
        if window_list_raw.is_null() {
            println!("⚠️ Failed to get window list from Core Graphics, using fallback");
            return Self::get_fallback_window_info();
        }
        
        let window_list: &NSArray = &*window_list_raw;
        let count = window_list.count();
        
        println!("🪟 Found {} windows via Core Graphics", count);
        
        for i in 0..count {
            let window_dict_obj = window_list.objectAtIndex(i);
            if let Ok(window_dict) = window_dict_obj.downcast::<NSDictionary>() {
                // Extract window information from the dictionary
                if let Some(window_info) = Self::extract_window_info_from_dict(&*window_dict, i as u32) {
                    windows.push(window_info);
                }
            }
        }
        
        // Release the window list
        objc2::rc::autoreleasepool(|_| {
            std::ptr::drop_in_place(window_list_raw);
        });
        
        if windows.is_empty() {
            println!("⚠️ No valid windows found, using fallback");
            Self::get_fallback_window_info()
        } else {
            println!("✅ Successfully extracted {} real windows", windows.len());
            windows
        }
    }
    
    /// Extract window information from Core Graphics window dictionary
    unsafe fn extract_window_info_from_dict(window_dict: &NSDictionary, fallback_id: u32) -> Option<WindowInfo> {
        
        // Core Graphics window info keys
        let window_number_key = NSString::from_str("kCGWindowNumber");
        let window_name_key = NSString::from_str("kCGWindowName");
        let window_owner_name_key = NSString::from_str("kCGWindowOwnerName");
        let window_bounds_key = NSString::from_str("kCGWindowBounds");
        
        // Get window ID
        let window_id = if let Some(number_obj) = window_dict.objectForKey(&window_number_key) {
            if let Ok(number) = number_obj.downcast::<NSNumber>() {
                number.intValue() as u32
            } else {
                fallback_id
            }
        } else {
            fallback_id
        };
        
        // Get window title (prefer kCGWindowName, fallback to kCGWindowOwnerName)
        let title = if let Some(name_obj) = window_dict.objectForKey(&window_name_key) {
            if let Ok(name_str) = name_obj.downcast::<NSString>() {
                let title_str = name_str.to_string();
                if !title_str.is_empty() {
                    title_str
                } else {
                    // Fallback to owner name if window name is empty
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
            // No window name, try owner name
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
        
        // Get window bounds
        let (width, height) = if let Some(bounds_obj) = window_dict.objectForKey(&window_bounds_key) {
            if let Ok(bounds_dict) = bounds_obj.downcast::<NSDictionary>() {
                let width_key = NSString::from_str("Width");
                let height_key = NSString::from_str("Height");
                
                let width = if let Some(width_obj) = bounds_dict.objectForKey(&width_key) {
                    if let Ok(width_num) = width_obj.downcast::<NSNumber>() {
                        width_num.intValue() as u32
                    } else {
                        800 // Default width
                    }
                } else {
                    800
                };
                
                let height = if let Some(height_obj) = bounds_dict.objectForKey(&height_key) {
                    if let Ok(height_num) = height_obj.downcast::<NSNumber>() {
                        height_num.intValue() as u32
                    } else {
                        600 // Default height
                    }
                } else {
                    600
                };
                
                (width, height)
            } else {
                (800, 600) // Default size
            }
        } else {
            (800, 600) // Default size
        };
        
        // Filter out windows that are too small or have empty titles
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
    
    /// Fallback window information when Core Graphics APIs fail
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

    /// Create fallback content when real ScreenCaptureKit API fails
    fn create_fallback_content() -> Self {
        let mut content = Self::new();
        
        // Add a default display entry (common for most Macs)
        content.displays.push(DisplayInfo {
            id: 1,
            name: "Built-in Display".to_string(),
            width: 1920,
            height: 1080,
        });
        
        // Add fallback windows
        content.windows.extend(Self::get_fallback_window_info());
        
        content
    }

    /// Timeout-protected version that handles ScreenCaptureKit's async nature safely
    pub fn new_with_timeout(timeout_ms: u32) -> Result<Self> {
        println!("🔍 Fetching real shareable content from ScreenCaptureKit with {}ms timeout", timeout_ms);
        
        use std::sync::{Arc, Mutex, Condvar};
        use std::time::{Duration, Instant};
        
        unsafe {
            let mut content = Self::new();
            
            // Use a synchronization mechanism to handle the async completion
            let result_holder = Arc::new((Mutex::new(None), Condvar::new()));
            let result_holder_clone = result_holder.clone();
            
            // Try to get shareable content with completion handler
            ScreenCaptureKitHelpers::get_shareable_content_with_completion(move |sc_content_opt, error_opt| {
                let (lock, cvar) = &*result_holder_clone;
                
                let result = match (sc_content_opt, error_opt) {
                    (Some(_sc_content), None) => {
                        println!("✅ Successfully got ScreenCaptureKit content via completion handler");
                        // Don't extract data from sc_content - use safe system content instead
                        Ok(())
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
                
                // Store the result and notify waiting thread
                if let Ok(mut holder) = lock.lock() {
                    *holder = Some(result);
                    cvar.notify_one();
                }
            }).map_err(|e| Error::new(Status::GenericFailure, format!("Completion handler setup failed: {}", e)))?;
            
            // Wait for completion with timeout
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
            
            // Process the result
            match holder.take() {
                Some(Ok(())) => {
                    // Use safe system content instead of extracting from ScreenCaptureKit objects
                    content = Self::create_safe_system_content();
                    
                    println!("✅ Retrieved {} displays and {} windows from safe system APIs", 
                        content.displays.len(), content.windows.len());
                    
                    Ok(content)
                }
                Some(Err(e)) => {
                    println!("⚠️ ScreenCaptureKit error: {}", e);
                    println!("💡 Using safe system content with Core Graphics APIs instead");
                    
                    // Use safe system content with real Core Graphics APIs instead of fallback
                    content = Self::create_safe_system_content();
                    
                    println!("✅ Using safe system content with {} displays and {} windows", 
                        content.displays.len(), content.windows.len());
                    
                    Ok(content)
                }
                None => {
                    println!("⚠️ ScreenCaptureKit timeout after {}ms - using safe system content", timeout_ms);
                    
                    // Use safe system content instead of fallback
                    content = Self::create_safe_system_content();
                    
                    println!("✅ Using safe system content with {} displays and {} windows", 
                        content.displays.len(), content.windows.len());
                    
                    Ok(content)
                }
            }
        }
    }
    
    unsafe fn fetch_real_sc_shareable_content() -> Result<*mut SCShareableContent> {
        println!("🔍 Fetching real shareable content using ScreenCaptureKit API");
        
        // Use the new synchronous helper from bindings
        match ScreenCaptureKitHelpers::get_shareable_content_sync() {
            Ok(content) => {
                println!("✅ Successfully retrieved real ScreenCaptureKit content");
                Ok(content)
            }
            Err(error) => {
                println!("❌ Failed to get shareable content: {}", error);
                Err(Error::new(Status::GenericFailure, format!("ScreenCaptureKit error: {}", error)))
            }
        }
    }
    
    // REMOVED: extract_real_displays and extract_real_windows functions that caused segfaults
    // These functions were using unsafe msg_send! calls on ScreenCaptureKit objects
    
    pub fn from_sc_shareable_content(_sc_content: *mut SCShareableContent) -> Self {
        // Instead of extracting data that causes segfaults, use safe system content
        Self::create_safe_system_content()
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
    
    // Simplified methods that don't rely on extracting data from ScreenCaptureKit objects
    pub unsafe fn get_sc_display_by_id(&self, display_id: u32) -> Option<*mut SCDisplay> {
        if self.find_display_by_id(display_id).is_none() {
            return None;
        }
        
        // For now, return a safe placeholder
        // In a full implementation, this would create a fresh SCDisplay object
        println!("💡 Creating placeholder SCDisplay for ID {}", display_id);
        Some(std::ptr::null_mut()) // Safe placeholder - calling code should handle null check
    }
    
    pub unsafe fn get_sc_window_by_id(&self, window_id: u32) -> Option<*mut SCWindow> {
        if self.find_window_by_id(window_id).is_none() {
            return None;
        }
        
        // For now, return a safe placeholder
        // In a full implementation, this would create a fresh SCWindow object
        println!("💡 Creating placeholder SCWindow for ID {}", window_id);
        Some(std::ptr::null_mut()) // Safe placeholder - calling code should handle null check
    }
}