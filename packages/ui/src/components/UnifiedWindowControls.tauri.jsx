import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Maximize2, Minimize2 } from 'lucide-react';

export const UnifiedWindowControls = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [platform, setPlatform] = useState('unknown');
  const [isTauri, setIsTauri] = useState(false);
  const [tauriWindow, setTauriWindow] = useState(null);

  // Helper to get Tauri window - use dynamic import for Tauri v2
  const getTauriWindow = async () => {
    if (tauriWindow) return tauriWindow;

    try {
      // Try Tauri v2 API
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      setTauriWindow(win);
      return win;
    } catch (e) {
      console.log('Tauri API not available:', e);
      return null;
    }
  };

  useEffect(() => {
    let unlisten;

    const initTauri = async () => {
      try {
        // Try to import Tauri API
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();

        setIsTauri(true);
        setTauriWindow(appWindow);

        // Detect platform from user agent
        if (navigator.platform.toLowerCase().includes('mac')) {
          setPlatform('darwin');
        } else if (navigator.platform.toLowerCase().includes('win')) {
          setPlatform('win32');
        } else {
          setPlatform('linux');
        }

        // Check current maximize state
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);

        // Listen for resize events to update maximize state
        unlisten = await appWindow.onResized(async () => {
          const maximized = await appWindow.isMaximized();
          setIsMaximized(maximized);
        });
      } catch (e) {
        // Not running in Tauri, try Electron
        setIsTauri(false);

        // Electron API
        window.electronAPI?.window?.getPlatform?.().then(platformInfo => {
          setPlatform(platformInfo.platform);
        });

        window.electronAPI?.window?.isMaximized?.().then(maximized => {
          setIsMaximized(maximized);
        });

        const unsubscribeMaximize = window.electronAPI?.window?.onMaximize?.(() => {
          setIsMaximized(true);
        });

        const unsubscribeUnmaximize = window.electronAPI?.window?.onUnmaximize?.(() => {
          setIsMaximized(false);
        });

        return () => {
          unsubscribeMaximize?.();
          unsubscribeUnmaximize?.();
        };
      }
    };

    initTauri();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleMinimize = async (e) => {
    e.stopPropagation();
    if (isTauri && tauriWindow) {
      await tauriWindow.minimize();
    } else {
      window.electronAPI?.window?.minimize?.();
    }
  };

  const handleMaximize = async (e) => {
    e.stopPropagation();
    if (isTauri && tauriWindow) {
      await tauriWindow.toggleMaximize();
    } else {
      window.electronAPI?.window?.maximize?.();
    }
  };

  const handleClose = async (e) => {
    e.stopPropagation();
    if (isTauri && tauriWindow) {
      await tauriWindow.close();
    } else {
      window.electronAPI?.window?.close?.();
    }
  };

  const isMacOS = platform === 'darwin' || platform === 'macos';

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
