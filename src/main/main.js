const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initialize, enable } = require('@electron/remote/main');
const whisperService = require('./services/whisper-service');

// Initialize remote module
initialize();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // Enable remote module for this window
  enable(mainWindow.webContents);

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for audio capture
ipcMain.handle('start-audio-capture', async (event, options) => {
  // TODO: Implement audio capture based on platform
  console.log('Starting audio capture with options:', options);
});

ipcMain.handle('stop-audio-capture', async () => {
  // TODO: Implement stop audio capture
  console.log('Stopping audio capture');
});

// IPC handlers for transcription
ipcMain.handle('start-transcription', async (event, options) => {
  try {
    await whisperService.initialize(options.modelSize);
    return { success: true };
  } catch (error) {
    console.error('Error initializing Whisper:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('process-audio-chunk', async (event, { audioData, options }) => {
  try {
    const result = await whisperService.processAudioChunk(audioData, options);
    return { success: true, result };
  } catch (error) {
    console.error('Error processing audio chunk:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-transcription', async () => {
  // Cleanup any resources if needed
  console.log('Stopping transcription');
}); 