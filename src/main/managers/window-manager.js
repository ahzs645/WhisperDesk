// src/main/managers/window-manager.js
const { BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');

class WindowManager {
  constructor(serviceManager) {
    this.mainWindow = null;
    this.serviceManager = serviceManager;
  }

  async createMainWindow() {
    console.log('🔧 Creating main window...');
    
    const preloadPath = path.join(__dirname, '../preload.js');
    const preloadExists = fs.existsSync(preloadPath);
    console.log('🔧 Preload script exists:', preloadExists);
    
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1000,
      minHeight: 700,
      show: false,
      center: true,
      frame: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: false,
      transparent: false,
      vibrancy: null,
      visualEffectState: 'inactive',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        webSecurity: true,
        backgroundThrottling: false,
        ...(preloadExists && { preload: preloadPath })
      },
      icon: path.join(__dirname, '../../../resources/icons/icon.png')
    });

    if (process.platform === 'darwin') {
      this.mainWindow.setWindowButtonVisibility(false);
    }

    this.setupWindowEvents();
    await this.loadRenderer();

    return this.mainWindow;
  }

  setupWindowEvents() {
    if (!this.mainWindow) return;

    this.mainWindow.webContents.on('did-finish-load', () => {
      console.log('✅ Renderer finished loading');
      
      // Setup event forwarding after window is ready
      if (this.serviceManager) {
        this.serviceManager.setupEventForwarding(this.mainWindow);
      }
    });

    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('❌ Renderer failed to load:', errorCode, errorDescription, validatedURL);
    });

    this.mainWindow.webContents.on('crashed', () => {
      console.error('❌ Renderer process crashed');
    });

    this.mainWindow.once('ready-to-show', () => {
      console.log('✅ Window ready to show');
      this.mainWindow.show();
    });

    this.mainWindow.on('maximize', () => {
      this.mainWindow.webContents.send('window:maximized');
    });

    this.mainWindow.on('unmaximize', () => {
      this.mainWindow.webContents.send('window:unmaximized');
    });

    this.mainWindow.on('closed', () => {
      console.log('🔧 Window closed');
      this.mainWindow = null;
    });
  }

  async loadRenderer() {
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      console.log('🔧 Loading development URL...');
      try {
        await this.mainWindow.loadURL('http://localhost:3000');
        console.log('✅ Dev URL loaded');
        this.mainWindow.webContents.openDevTools();
      } catch (error) {
        console.error('❌ Failed to load dev URL:', error);
        this.loadFallback();
      }
    } else {
      console.log('🔧 Loading production renderer...');
      
      const possiblePaths = [
        path.join(process.resourcesPath, 'app.asar', 'src/renderer/whisperdesk-ui/dist/index.html'),
        path.join(process.resourcesPath, 'app', 'src/renderer/whisperdesk-ui/dist/index.html'),
        path.join(__dirname, '../../renderer/whisperdesk-ui/dist/index.html'),
        path.join(app.getAppPath(), 'src/renderer/whisperdesk-ui/dist/index.html')
      ];
      
      let indexPath = null;
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          indexPath = testPath;
          console.log('✅ Found renderer at:', indexPath);
          break;
        }
      }
      
      if (indexPath) {
        try {
          await this.mainWindow.loadFile(indexPath);
          console.log('✅ Renderer loaded successfully');
        } catch (error) {
          console.error('❌ Failed to load renderer:', error);
          this.loadFallback();
        }
      } else {
        console.error('❌ No renderer files found');
        this.loadFallback();
      }
    }
  }

  loadFallback() {
    const fallbackHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhisperDesk</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; background: #1a1a1a; color: white; }
          .success { color: #4CAF50; }
          .error { color: #f44336; }
          .warning { color: #ff9800; }
        </style>
      </head>
      <body>
        <h1>🎵 WhisperDesk Enhanced</h1>
        <p class="success">✅ Electron is working!</p>
        <p class="warning">⚠️ Some services may be running in fallback mode</p>
        <p class="error">❌ Could not load main interface</p>
      </body>
      </html>
    `;
    
    this.mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHTML)}`);
  }

  getMainWindow() {
    return this.mainWindow;
  }

  isMainWindowAvailable() {
    return this.mainWindow && !this.mainWindow.isDestroyed();
  }

  sendToRenderer(channel, data) {
    if (this.isMainWindowAvailable()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}

module.exports = WindowManager;