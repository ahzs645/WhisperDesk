// main-debug.js - Minimal debug version to test basic Electron functionality
const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

console.log('🚀 Debug: Starting WhisperDesk debug version...');
console.log('🚀 Debug: Node version:', process.version);
console.log('🚀 Debug: Electron version:', process.versions.electron);
console.log('🚀 Debug: Platform:', process.platform);
console.log('🚀 Debug: Architecture:', process.arch);
console.log('🚀 Debug: Working directory:', process.cwd());
console.log('🚀 Debug: App path:', app.getAppPath());
console.log('🚀 Debug: Resources path:', process.resourcesPath);

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  console.log('❌ Debug: Another instance is already running');
  app.quit();
  process.exit(0);
}

let mainWindow = null;

function createWindow() {
  console.log('🔧 Debug: Creating window...');
  
  // Check if preload script exists
  const preloadPath = path.join(__dirname, 'preload.js');
  const minimalPreloadPath = path.join(__dirname, 'preload-minimal.js');
  const preloadExists = fs.existsSync(preloadPath);
  const minimalPreloadExists = fs.existsSync(minimalPreloadPath);
  
  console.log('🔧 Debug: Preload script exists:', preloadExists, 'at', preloadPath);
  console.log('🔧 Debug: Minimal preload exists:', minimalPreloadExists, 'at', minimalPreloadPath);
  
  // Choose which preload to use
  let selectedPreload = null;
  if (minimalPreloadExists) {
    selectedPreload = minimalPreloadPath;
    console.log('🔧 Debug: Using MINIMAL preload for testing');
  } else if (preloadExists) {
    selectedPreload = preloadPath;
    console.log('🔧 Debug: Using regular preload');
  }
  
  if (selectedPreload) {
    try {
      const preloadContent = fs.readFileSync(selectedPreload, 'utf8');
      console.log('🔍 Debug: Preload script preview (first 200 chars):');
      console.log(preloadContent.substring(0, 200) + '...');
      
      if (preloadContent.includes('electronAPI')) {
        console.log('✅ Debug: Preload script mentions electronAPI');
      } else {
        console.log('⚠️ Debug: Preload script does NOT mention electronAPI');
      }
    } catch (error) {
      console.error('❌ Debug: Could not read preload script:', error.message);
    }
  }
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true, // Show immediately for debugging
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Disable for debugging
      ...(selectedPreload && { preload: selectedPreload }) // Use selected preload script
    }
  });

  // Open DevTools immediately to see any errors
  mainWindow.webContents.openDevTools();

  // Test different renderer loading strategies
  const isDev = process.env.NODE_ENV === 'development';
  console.log('🔧 Debug: Development mode:', isDev);

  if (isDev) {
    console.log('🔧 Debug: Loading development URL...');
    mainWindow.loadURL('http://localhost:5173')
      .then(() => console.log('✅ Debug: Dev URL loaded successfully'))
      .catch(error => {
        console.error('❌ Debug: Failed to load dev URL:', error);
        loadFallbackHTML();
      });
  } else {
    console.log('🔧 Debug: Looking for renderer files...');
    
    // List all possible paths and check each one
    const possiblePaths = [
      path.join(process.resourcesPath, 'app.asar', 'src/renderer/whisperdesk-ui/dist/index.html'),
      path.join(process.resourcesPath, 'app', 'src/renderer/whisperdesk-ui/dist/index.html'),
      path.join(__dirname, '../renderer/whisperdesk-ui/dist/index.html'),
      path.join(__dirname, '../../src/renderer/whisperdesk-ui/dist/index.html'),
      path.join(process.cwd(), 'src/renderer/whisperdesk-ui/dist/index.html'),
      path.join(app.getAppPath(), 'src/renderer/whisperdesk-ui/dist/index.html')
    ];
    
    console.log('🔍 Debug: Checking paths:');
    let foundPath = null;
    
    for (const testPath of possiblePaths) {
      const exists = fs.existsSync(testPath);
      console.log(`  ${exists ? '✅' : '❌'} ${testPath}`);
      if (exists && !foundPath) {
        foundPath = testPath;
      }
    }
    
    if (foundPath) {
      console.log('✅ Debug: Found renderer at:', foundPath);
      
      // Try to read the beginning of the HTML file to see what's in it
      try {
        const htmlContent = fs.readFileSync(foundPath, 'utf8');
        const firstFewLines = htmlContent.split('\n').slice(0, 10).join('\n');
        console.log('🔍 Debug: Renderer HTML preview:');
        console.log(firstFewLines);
        console.log('...(truncated)');
        
        // Check if it mentions electron or vite
        if (htmlContent.includes('electron')) {
          console.log('✅ Debug: Renderer mentions electron');
        } else {
          console.log('⚠️ Debug: Renderer does NOT mention electron');
        }
        
        if (htmlContent.includes('vite')) {
          console.log('✅ Debug: Renderer built with Vite');
        }
      } catch (error) {
        console.error('❌ Debug: Could not read renderer file:', error.message);
      }
      
      mainWindow.loadFile(foundPath)
        .then(() => {
          console.log('✅ Debug: Renderer loaded successfully');
          
          // Test electronAPI injection after a brief delay
          setTimeout(() => {
            mainWindow.webContents.executeJavaScript(`
              console.log('🔍 Testing electronAPI availability...');
              console.log('window.electronAPI exists:', !!window.electronAPI);
              console.log('window.electronAPI keys:', window.electronAPI ? Object.keys(window.electronAPI) : 'undefined');
              
              // Test if the app detected Electron
              const appDetectedElectron = typeof window !== 'undefined' && !!window.electronAPI;
              console.log('App detected Electron:', appDetectedElectron);
              
              // Send back the result
              'electronAPI test: ' + (window.electronAPI ? 'AVAILABLE' : 'NOT AVAILABLE');
            `).then(result => {
              console.log('🔍 Debug: electronAPI test result:', result);
            }).catch(error => {
              console.error('❌ Debug: Failed to test electronAPI:', error);
            });
          }, 2000);
          
          // Keep window open for 60 seconds for debugging
          setTimeout(() => {
            console.log('🔧 Debug: 60 seconds elapsed, you can close window now');
          }, 60000);
        })
        .catch(error => {
          console.error('❌ Debug: Failed to load renderer:', error);
          loadFallbackHTML();
        });
    } else {
      console.error('❌ Debug: No renderer files found!');
      
      // Let's explore the actual file structure
      console.log('🔍 Debug: Exploring file structure...');
      
      const explorePaths = [
        process.resourcesPath,
        app.getAppPath(),
        process.cwd(),
        __dirname
      ];
      
      for (const explorePath of explorePaths) {
        try {
          if (fs.existsSync(explorePath)) {
            console.log(`\n📁 Contents of ${explorePath}:`);
            const items = fs.readdirSync(explorePath, { withFileTypes: true });
            items.slice(0, 10).forEach(item => { // Limit to first 10 items
              console.log(`  ${item.isDirectory() ? '📁' : '📄'} ${item.name}`);
            });
            if (items.length > 10) {
              console.log(`  ... and ${items.length - 10} more items`);
            }
          }
        } catch (error) {
          console.log(`❌ Cannot explore ${explorePath}: ${error.message}`);
        }
      }
      
      loadFallbackHTML();
    }
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('❌ Debug: Renderer failed to load:', {
      errorCode,
      errorDescription,
      url: validatedURL
    });
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Debug: Renderer loaded successfully');
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('❌ Debug: Renderer process crashed');
  });

  // Prevent immediate closing for debugging
  let allowClose = false;
  
  mainWindow.on('close', (event) => {
    console.log('🔧 Debug: Window attempting to close');
    if (!allowClose) {
      event.preventDefault();
      console.log('🔧 Debug: Window close prevented for debugging');
      console.log('🔧 Debug: The window will stay open so you can inspect it');
      console.log('🔧 Debug: Press Ctrl+Shift+I to open DevTools');
      console.log('🔧 Debug: To allow closing, wait 60 seconds or press Ctrl+W twice');
      
      // Allow closing after 60 seconds or if user really wants to close
      setTimeout(() => {
        allowClose = true;
        console.log('🔧 Debug: Window close now allowed');
      }, 60000);
    }
  });

  // Listen for keyboard shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key.toLowerCase() === 'w') {
      console.log('🔧 Debug: Ctrl+W pressed, allowing close');
      allowClose = true;
      mainWindow.close();
    }
  });

  mainWindow.on('closed', () => {
    console.log('🔧 Debug: Window closed');
    mainWindow = null;
  });

  // Log renderer process errors
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`🔧 Debug: Renderer console [${level}]:`, message);
    if (line) console.log(`  at line ${line} in ${sourceId}`);
  });

  // More detailed error logging
  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('❌ Debug: Preload script error:', preloadPath, error);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('❌ Debug: Render process gone:', details);
  });

  console.log('✅ Debug: Window created successfully');
}

function loadFallbackHTML() {
  console.log('🔧 Debug: Loading fallback HTML...');
  
  const fallbackHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>WhisperDesk Debug</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 40px; 
          background: #1a1a1a; 
          color: white; 
        }
        .debug-info { 
          background: #2a2a2a; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 20px 0; 
        }
        .success { color: #4CAF50; }
        .error { color: #f44336; }
        .warning { color: #ff9800; }
      </style>
    </head>
    <body>
      <h1>🐛 WhisperDesk Debug Mode</h1>
      <p class="success">✅ Electron is working!</p>
      <p class="error">❌ Could not find renderer files</p>
      
      <div class="debug-info">
        <h3>Debug Information:</h3>
        <p><strong>Platform:</strong> ${process.platform}</p>
        <p><strong>Architecture:</strong> ${process.arch}</p>
        <p><strong>Node Version:</strong> ${process.version}</p>
        <p><strong>Electron Version:</strong> ${process.versions.electron}</p>
        <p><strong>App Path:</strong> ${app.getAppPath()}</p>
        <p><strong>Resources Path:</strong> ${process.resourcesPath}</p>
        <p><strong>Working Directory:</strong> ${process.cwd()}</p>
        <p><strong>__dirname:</strong> ${__dirname}</p>
      </div>
      
      <div class="debug-info">
        <h3>Possible Issues:</h3>
        <ul>
          <li class="warning">Renderer files not built correctly</li>
          <li class="warning">Renderer built for web instead of Electron</li>
          <li class="warning">Vite configuration issue</li>
          <li class="warning">Missing preload script</li>
        </ul>
      </div>
      
      <div class="debug-info">
        <h3>Next Steps:</h3>
        <ol>
          <li>Check if renderer files were built correctly</li>
          <li>Verify Vite is configured for Electron target</li>
          <li>Check renderer console for errors (F12)</li>
          <li>Verify packaging configuration in package.json</li>
        </ol>
      </div>
      
      <script>
        console.log('🔧 Debug: Fallback HTML script running');
        console.log('Window will stay open for debugging');
        
        // Test if we have access to electron APIs
        if (typeof window !== 'undefined') {
          console.log('✅ window object available');
          if (window.electronAPI) {
            console.log('✅ electronAPI available');
            console.log('electronAPI keys:', Object.keys(window.electronAPI));
          } else {
            console.log('❌ electronAPI NOT available');
            console.log('This is why the app is showing web-compatible version');
          }
          
          // Test if process object is available (another Electron indicator)
          if (typeof process !== 'undefined') {
            console.log('✅ process object available');
            console.log('process.versions:', process.versions);
          } else {
            console.log('❌ process object NOT available');
          }
        }
        
        // Try to detect if we're in Electron some other way
        const userAgent = navigator.userAgent;
        console.log('User agent:', userAgent);
        if (userAgent.includes('Electron')) {
          console.log('✅ User agent indicates Electron');
        } else {
          console.log('❌ User agent does NOT indicate Electron');
        }
      </script>
    </body>
    </html>
  `;
  
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHTML)}`)
    .then(() => {
      console.log('✅ Debug: Fallback HTML loaded');
      // Keep window open for debugging
      setTimeout(() => {
        console.log('🔧 Debug: 60 seconds elapsed, you can close fallback window now');
      }, 60000);
    })
    .catch(error => console.error('❌ Debug: Failed to load fallback HTML:', error));
}

app.whenReady().then(() => {
  console.log('🚀 Debug: App ready, creating window...');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('🔧 Debug: All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('🔧 Debug: App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  console.log('🔧 Debug: App is quitting...');
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Debug: Uncaught Exception:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Debug: Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('🚀 Debug: Main process setup complete, waiting for app ready...');