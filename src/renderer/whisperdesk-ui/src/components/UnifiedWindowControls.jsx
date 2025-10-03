import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Maximize2, Minimize2 } from 'lucide-react';

export const UnifiedWindowControls = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [platform, setPlatform] = useState('unknown');

  useEffect(() => {
    const initializeControls = async () => {
      // Check if Tauri is available
      if (typeof window !== 'undefined' && window.__TAURI__) {
        try {
          const { getCurrentWindow } = window.__TAURI__.window;
          const { platform } = window.__TAURI__.os;
          
          // Get platform info
          const platformName = await platform();
          console.log('Detected platform:', platformName);
          setPlatform(platformName);
          
          // Get current window
          const appWindow = getCurrentWindow();
          
          // Check current maximize state
          const maximized = await appWindow.isMaximized();
          setIsMaximized(maximized);
          
          // Don't set up automatic event listeners to prevent freeze issues
          // We'll manually track state in the button handlers instead
          console.log('🔄 Window controls initialized, no automatic state tracking');
          
          // Set up manual dragging for header area
          const setupDragging = () => {
            const headerContent = document.querySelector('.unified-header-content');
            if (headerContent) {
              console.log('🔄 Setting up drag listener on header');
              
              const handleMouseDown = async (e) => {
                console.log('🔄 Mouse down event:', {
                  button: e.button,
                  buttons: e.buttons,
                  target: e.target.tagName,
                  closest_button: !!e.target.closest('button'),
                  detail: e.detail
                });
                
                // Only drag with left mouse button and avoid buttons
                if (e.button === 0 && !e.target.closest('button') && !e.target.closest('.windows-controls')) {
                  console.log('🔄 Valid drag conditions met');
                  
                  if (e.detail === 2) {
                    // Double click to maximize/restore
                    console.log('🔄 Double click detected - toggling maximize');
                    e.preventDefault();
                    handleMaximize();
                  } else {
                    // Single click to start dragging
                    console.log('🔄 Starting window drag...');
                    try {
                      await appWindow.startDragging();
                      console.log('✅ Window dragging started');
                    } catch (error) {
                      console.error('❌ Failed to start dragging:', error);
                    }
                  }
                }
              };
              
              headerContent.addEventListener('mousedown', handleMouseDown);
              console.log('✅ Manual dragging listener added to header');
            } else {
              console.error('❌ Header content not found for dragging');
            }
          };
          
          // Add small delay to ensure DOM is ready
          setTimeout(setupDragging, 100);
        } catch (error) {
          console.error('Error initializing Tauri window controls:', error);
        }
      }
    };

    initializeControls();
  }, []);

  const handleMinimize = async () => {
    console.log('🔹 Minimize button clicked');
    try {
      if (window.__TAURI__) {
        console.log('🔹 Tauri API available, attempting to minimize...');
        const { getCurrentWindow } = window.__TAURI__.window;
        const appWindow = getCurrentWindow();
        await appWindow.minimize();
        console.log('✅ Window minimized successfully');
      } else {
        console.error('❌ Tauri API not available');
      }
    } catch (error) {
      console.error('❌ Failed to minimize window:', error);
    }
  };

  const handleMaximize = async () => {
    console.log('🔸 Maximize button clicked, current state:', isMaximized);
    try {
      if (window.__TAURI__) {
        console.log('🔸 Tauri API available, attempting to maximize/restore...');
        const { getCurrentWindow } = window.__TAURI__.window;
        const appWindow = getCurrentWindow();
        
        // Simply toggle state immediately to prevent UI freeze
        const newState = !isMaximized;
        setIsMaximized(newState);
        
        if (isMaximized) {
          await appWindow.unmaximize();
          console.log('✅ Window unmaximized successfully');
        } else {
          await appWindow.maximize();
          console.log('✅ Window maximized successfully');
        }
      } else {
        console.error('❌ Tauri API not available');
      }
    } catch (error) {
      console.error('❌ Failed to maximize/unmaximize window:', error);
      // Revert state if operation failed
      setIsMaximized(!isMaximized);
    }
  };

  const handleClose = async () => {
    if (window.__TAURI__) {
      const { getCurrentWindow } = window.__TAURI__.window;
      const appWindow = getCurrentWindow();
      await appWindow.close();
    }
  };

  const isMacOS = false; // Force Windows-style square controls as requested
  console.log('Using square controls, Platform:', platform);

  if (isMacOS) {
    // macOS-style traffic light controls
    return (
      <div className="flex items-center space-x-2 macos-controls">
        <button
          onClick={handleClose}
          className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center group"
          title="Close"
        >
          <X className="w-2 h-2 text-red-900 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button
          onClick={handleMinimize}
          className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center group"
          title="Minimize"
        >
          <Minus className="w-2 h-2 text-yellow-900 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center group"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Minimize2 className="w-2 h-2 text-green-900 opacity-0 group-hover:opacity-100 transition-opacity" />
          ) : (
            <Maximize2 className="w-2 h-2 text-green-900 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      </div>
    );
  }

  // Windows/Linux-style controls
  return (
    <div className="flex items-center windows-controls">
      <button
        onClick={handleMinimize}
        className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        title="Minimize"
      >
        <Minus className="w-4 h-4" />
      </button>
      <button
        onClick={handleMaximize}
        className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? (
          <div className="w-3 h-3 border border-current">
            <div className="w-2 h-2 border border-current ml-1 -mt-1 bg-background"></div>
          </div>
        ) : (
          <Square className="w-3 h-3" />
        )}
      </button>
      <button
        onClick={handleClose}
        className="w-8 h-8 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
        title="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};