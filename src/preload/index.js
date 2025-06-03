const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    setTheme: (theme) => ipcRenderer.invoke('window:setTheme', theme),
    onThemeChanged: (callback) => {
      ipcRenderer.on('theme-changed', (_, theme) => callback(theme))
    },
    removeThemeListener: (callback) => {
      ipcRenderer.removeListener('theme-changed', callback)
    }
  },
  // Screen recording
  screenRecorder: {
    startRecording: (options) => ipcRenderer.invoke('screen-recorder:start', options),
    stopRecording: () => ipcRenderer.invoke('screen-recorder:stop'),
    onRecordingComplete: (callback) => {
      ipcRenderer.on('screen-recorder:complete', (_, filePath) => callback(filePath))
    },
    removeRecordingListener: (callback) => {
      ipcRenderer.removeListener('screen-recorder:complete', callback)
    }
  }
}) 