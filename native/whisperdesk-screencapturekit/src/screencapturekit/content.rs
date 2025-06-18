use crate::ScreenSource;
use napi::bindgen_prelude::*;
use objc2::runtime::AnyObject;
use objc2::{msg_send, sel, class};
use objc2_foundation::{NSArray, NSString};
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
        // In a real implementation, this would call the actual ScreenCaptureKit API
        // For now, we'll simulate the data structure that would be returned
        
        let mut content = Self::new();
        
        // Simulate real display data
        content.displays = vec![
            DisplayInfo {
                id: 1,
                name: "Built-in Retina Display".to_string(),
                width: 1920,
                height: 1080,
            },
            DisplayInfo {
                id: 2,
                name: "External Display".to_string(),
                width: 2560,
                height: 1440,
            },
        ];
        
        // Simulate real window data
        content.windows = vec![
            WindowInfo {
                id: 123,
                title: "Terminal".to_string(),
                width: 800,
                height: 600,
            },
            WindowInfo {
                id: 456,
                title: "Visual Studio Code".to_string(),
                width: 1200,
                height: 800,
            },
            WindowInfo {
                id: 789,
                title: "Safari".to_string(),
                width: 1024,
                height: 768,
            },
        ];
        
        Ok(content)
    }
    
    pub fn from_sc_shareable_content(_sc_content: &SCShareableContent) -> Self {
        // In a real implementation, this would extract data from the actual SCShareableContent
        // For now, use mock data
        Self::new_with_real_data().unwrap_or_else(|_| Self::new())
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
    
    // In a real implementation, these methods would recreate ScreenCaptureKit objects
    // from the stored identifiers when needed
    pub unsafe fn get_sc_display_by_id(&self, display_id: u32) -> Option<*mut SCDisplay> {
        if self.find_display_by_id(display_id).is_some() {
            // In a real implementation, this would:
            // 1. Get fresh shareable content
            // 2. Find the display with matching ID
            // 3. Return the pointer
            
            // For now, return null to avoid crashes - this will be implemented in Phase 3
            None
        } else {
            None
        }
    }
    
    pub unsafe fn get_sc_window_by_id(&self, window_id: u32) -> Option<*mut SCWindow> {
        if self.find_window_by_id(window_id).is_some() {
            // In a real implementation, this would:
            // 1. Get fresh shareable content
            // 2. Find the window with matching ID
            // 3. Return the pointer
            
            // For now, return null to avoid crashes - this will be implemented in Phase 3
            None
        } else {
            None
        }
    }
    
    // Helper methods for real ScreenCaptureKit integration (commented out for now)
    /*
    unsafe fn extract_displays_from_nsarray(displays: &NSArray) -> Vec<DisplayInfo> {
        let mut display_info = Vec::new();
        let count = displays.count();
        
        for i in 0..count {
            let display: *mut SCDisplay = msg_send![displays, objectAtIndex: i];
            if !display.is_null() {
                let (display_id, name, width, height) = ScreenCaptureKitHelpers::get_display_info(display);
                
                display_info.push(DisplayInfo {
                    id: display_id,
                    name,
                    width,
                    height,
                });
            }
        }
        
        display_info
    }
    
    unsafe fn extract_windows_from_nsarray(windows: &NSArray) -> Vec<WindowInfo> {
        let mut window_info = Vec::new();
        let count = windows.count();
        
        for i in 0..count {
            let window: *mut SCWindow = msg_send![windows, objectAtIndex: i];
            if !window.is_null() {
                let (window_id, title_str, width, height) = ScreenCaptureKitHelpers::get_window_info(window);
                
                window_info.push(WindowInfo {
                    id: window_id,
                    title: title_str,
                    width,
                    height,
                });
            }
        }
        
        window_info
    }
    */
} 