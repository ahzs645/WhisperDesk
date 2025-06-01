const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');

// Services
const ModelManager = require('./services/model-manager');
const TranscriptionService = require('./services/transcription-service');
const AudioService = require('./services/audio-service');
const SettingsService = require('./services/settings-service');
const ExportService = require('./services/export-service');

// Initialize store
const store = new Store();

class WhisperDeskApp {
  constructor() {
    this.mainWindow = null;
    this.isQuitting = false;
    
    // Initialize services
    this.modelManager = new ModelManager();
    this.transcriptionService = new TranscriptionService(this.modelManager);
    this.audioService = new AudioService();
    this.settingsService = new SettingsService();
    this.exportService = new ExportService();
    
    this.setupEventHandlers();
  }

  async initialize() {
    await this.createWindow();
    this.setupMenu();
    this.setupAutoUpdater();
    await this.initializeServices();
  }

  async createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      show: false,
      frame: true,
      titleBarStyle: 'default',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: true
      },
      icon: path.join(__dirname, '../../resources/icon.png')
    });

    // Load the app
    if (process.env.NODE_ENV === 'development') {
      await this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      const indexPath = path.join(__dirname, '../renderer/whisperdesk-ui/dist/index.html');
      await this.mainWindow.loadFile(indexPath);
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      
      // Focus on window
      if (process.platform === 'darwin') {
        this.mainWindow.focus();
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle window close
    this.mainWindow.on('close', (event) => {
      if (process.platform === 'darwin' && !this.isQuitting) {
        event.preventDefault();
        this.mainWindow.hide();
      }
    });
  }

  setupMenu() {
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Transcription',
            accelerator: 'CmdOrCtrl+N',
            click: () => this.mainWindow.webContents.send('menu-new-transcription')
          },
          {
            label: 'Open Audio File',
            accelerator: 'CmdOrCtrl+O',
            click: () => this.handleOpenFile()
          },
          { type: 'separator' },
          {
            label: 'Export Transcription',
            accelerator: 'CmdOrCtrl+E',
            click: () => this.mainWindow.webContents.send('menu-export')
          },
          { type: 'separator' },
          {
            label: process.platform === 'darwin' ? 'Quit WhisperDesk' : 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              this.isQuitting = true;
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectall' }
        ]
      },
      {
        label: 'Models',
        submenu: [
          {
            label: 'Model Marketplace',
            click: () => this.mainWindow.webContents.send('menu-model-marketplace')
          },
          {
            label: 'Manage Models',
            click: () => this.mainWindow.webContents.send('menu-manage-models')
          },
          { type: 'separator' },
          {
            label: 'Download Models',
            click: () => this.mainWindow.webContents.send('menu-download-models')
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About WhisperDesk',
            click: () => this.showAbout()
          },
          {
            label: 'Learn More',
            click: () => shell.openExternal('https://github.com/whisperdesk/whisperdesk-enhanced')
          }
        ]
      }
    ];

    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      });

      // Window menu
      template[5].submenu = [
        { role: 'close' },
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ];
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  setupAutoUpdater() {
    if (process.env.NODE_ENV === 'production') {
      autoUpdater.checkForUpdatesAndNotify();
      
      autoUpdater.on('update-available', () => {
        this.mainWindow.webContents.send('update-available');
      });

      autoUpdater.on('update-downloaded', () => {
        this.mainWindow.webContents.send('update-downloaded');
      });
    }
  }

  async initializeServices() {
    try {
      await this.modelManager.initialize();
      await this.transcriptionService.initialize();
      await this.audioService.initialize();
      await this.settingsService.initialize();
      
      console.log('All services initialized successfully');
    } catch (error) {
      console.error('Error initializing services:', error);
    }
  }

  setupEventHandlers() {
    // App event handlers
    app.whenReady().then(() => this.initialize());

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await this.createWindow();
      } else if (this.mainWindow) {
        this.mainWindow.show();
      }
    });

    app.on('before-quit', () => {
      this.isQuitting = true;
    });

    // IPC handlers
    this.setupIpcHandlers();
  }

  setupIpcHandlers() {
    // Model management
    ipcMain.handle('model:getAvailable', () => this.modelManager.getAvailableModels());
    ipcMain.handle('model:getInstalled', () => this.modelManager.getInstalledModels());
    ipcMain.handle('model:download', (event, modelId) => this.modelManager.downloadModel(modelId));
    ipcMain.handle('model:delete', (event, modelId) => this.modelManager.deleteModel(modelId));
    ipcMain.handle('model:getInfo', (event, modelId) => this.modelManager.getModelInfo(modelId));

    // Transcription
    ipcMain.handle('transcription:start', (event, options) => this.transcriptionService.startTranscription(options));
    ipcMain.handle('transcription:stop', () => this.transcriptionService.stopTranscription());
    ipcMain.handle('transcription:processFile', (event, filePath, options) => this.transcriptionService.processFile(filePath, options));
    ipcMain.handle('transcription:getProviders', () => this.transcriptionService.getProviders());

    // Audio
    ipcMain.handle('audio:getDevices', () => this.audioService.getDevices());
    ipcMain.handle('audio:startRecording', (event, deviceId) => this.audioService.startRecording(deviceId));
    ipcMain.handle('audio:stopRecording', () => this.audioService.stopRecording());
    ipcMain.handle('audio:getWaveform', (event, filePath) => this.audioService.getWaveform(filePath));

    // Settings
    ipcMain.handle('settings:get', (event, key) => this.settingsService.get(key));
    ipcMain.handle('settings:set', (event, key, value) => this.settingsService.set(key, value));
    ipcMain.handle('settings:getAll', () => this.settingsService.getAll());

    // Export
    ipcMain.handle('export:text', (event, data, format) => this.exportService.exportText(data, format));
    ipcMain.handle('export:subtitle', (event, data, format) => this.exportService.exportSubtitle(data, format));
    ipcMain.handle('export:copy', (event, text) => this.exportService.copyToClipboard(text));

    // File operations
    ipcMain.handle('file:showOpenDialog', (event, options) => this.showOpenDialog(options));
    ipcMain.handle('file:showSaveDialog', (event, options) => this.showSaveDialog(options));

    // App operations
    ipcMain.handle('app:getVersion', () => app.getVersion());
    ipcMain.handle('app:restart', () => {
      autoUpdater.quitAndInstall();
    });
  }

  async handleOpenFile() {
    const result = await dialog.showOpenDialog(this.mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'] },
        { name: 'Video Files', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      this.mainWindow.webContents.send('file-opened', result.filePaths[0]);
    }
  }

  async showOpenDialog(options) {
    const result = await dialog.showOpenDialog(this.mainWindow, options);
    return result;
  }

  async showSaveDialog(options) {
    const result = await dialog.showSaveDialog(this.mainWindow, options);
    return result;
  }

  showAbout() {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'About WhisperDesk Enhanced',
      message: 'WhisperDesk Enhanced',
      detail: `Version: ${app.getVersion()}\\n\\nAdvanced cross-platform transcription application with model marketplace and speaker recognition.\\n\\nBuilt with Electron and modern web technologies.`
    });
  }
}

// Create and start the app
const whisperDeskApp = new WhisperDeskApp();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

