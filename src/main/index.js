import { app, BrowserWindow, ipcMain } from 'electron'
import { nativeTheme } from 'electron'
import path from 'path'
import isDev from 'electron-is-dev'

let mainWindow
let appState = {
  theme: 'system'
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
      // Add CSP
      webSecurity: true
    },
    // Make the window frameless
    frame: false,
    // Enable transparency for the window
    transparent: true,
    // Set the background color to be transparent
    backgroundColor: '#00000000',
    // Enable the traffic lights on macOS
    titleBarStyle: 'hiddenInset',
    // Enable the window controls on Windows/Linux
    titleBarOverlay: true
  })

  // Set CSP headers
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "connect-src 'self' https:",
          "font-src 'self'",
          "object-src 'none'",
          "media-src 'self'",
          "frame-src 'none'"
        ].join('; ')
      }
    })
  })

  // Load the app
  mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../renderer/whisperdesk-ui/dist/index.html')}`
  )

  // Set initial theme
  mainWindow.webContents.on('did-finish-load', () => {
    const isDark = nativeTheme.shouldUseDarkColors
    mainWindow.webContents.send('theme-changed', isDark ? 'dark' : 'light')
    updateTitleBarTheme(appState.theme)
  })

  // Setup theme handling
  setupThemeHandling()
}

function setupThemeHandling() {
  nativeTheme.on('updated', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const isDark = nativeTheme.shouldUseDarkColors
      mainWindow.webContents.send('theme-changed', isDark ? 'dark' : 'light')
      if (appState.theme === 'system') {
        updateTitleBarTheme('system')
      }
    }
  })
}

function updateTitleBarTheme(theme) {
  if (!mainWindow) return

  const isDark = theme === 'dark' || (theme === 'system' && nativeTheme.shouldUseDarkColors)
  
  if (process.platform === 'darwin') {
    // macOS specific settings
    mainWindow.setTitleBarOverlay({
      color: isDark ? '#1a1a1a' : '#ffffff',
      symbolColor: isDark ? '#ffffff' : '#1a1a1a',
      height: 28
    })
  } else if (process.platform === 'win32') {
    // Windows specific settings
    mainWindow.setTitleBarOverlay({
      color: isDark ? '#1a1a1a' : '#ffffff',
      symbolColor: isDark ? '#ffffff' : '#1a1a1a',
      height: 32,
      cornerStyle: 'rounded'
    })
  } else {
    // Linux specific settings
    mainWindow.setTitleBarOverlay({
      color: isDark ? '#1a1a1a' : '#ffffff',
      symbolColor: isDark ? '#ffffff' : '#1a1a1a',
      height: 32
    })
  }
}

ipcMain.handle('window:setTheme', (event, theme) => {
  appState.theme = theme
  updateTitleBarTheme(theme)
})

// ... rest of the existing code ... 