// src/renderer/whisperdesk-ui/src/App.jsx - With persistent file state
import React, { useState, useEffect, createContext, useContext } from 'react'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Mic, Package, Clock, Settings, Video } from 'lucide-react'
import { ModelMarketplace } from './components/ModelMarketplace-WebCompatible'
import { TranscriptionTab } from './components/TranscriptionTab-WebCompatible'
import { TranscriptionTabElectron } from './components/TranscriptionTabElectron'
import { ScreenRecorder } from './components/ScreenRecorder'
import { SettingsTab } from './components/SettingsTab'
import { Toaster } from 'sonner'
import './App.css'
import { Label } from './components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select'

// Create context for app-wide state
const AppStateContext = createContext()

export const useAppState = () => {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider')
  }
  return context
}

function AppStateProvider({ children }) {
  const [appState, setAppState] = useState({
    // File selection state
    selectedFile: null,
    
    // Transcription state
    transcription: '',
    isTranscribing: false,
    progress: 0,
    progressMessage: '',
    
    // Settings state
    selectedProvider: 'whisper-native',
    selectedModel: 'whisper-tiny',
    
    // Recording state
    isRecording: false,
    recordingSettings: {
      includeMicrophone: true,
      includeSystemAudio: true
    },
    
    // Results state
    lastTranscriptionResult: null,
    
    // Environment
    isElectron: false,
    theme: localStorage.getItem('theme') || 'system'
  })

  // Initialize theme
  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'system'
    setAppState(prev => ({ ...prev, theme }))
    
    // Apply initial theme
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      document.documentElement.classList.add(systemTheme)
    } else {
      document.documentElement.classList.add(theme)
    }
  }, [])

  // Update helper function
  const updateAppState = (updates) => {
    setAppState(prev => ({ ...prev, ...updates }))
  }

  // Reset transcription state (but keep file and settings)
  const resetTranscription = () => {
    updateAppState({
      transcription: '',
      isTranscribing: false,
      progress: 0,
      progressMessage: '',
      lastTranscriptionResult: null
    })
  }

  // Clear everything (new session)
  const clearAll = () => {
    setAppState({
      ...appState,
      selectedFile: null,
      transcription: '',
      isTranscribing: false,
      progress: 0,
      progressMessage: '',
      lastTranscriptionResult: null
    })
  }

  // Add theme change listener
  useEffect(() => {
    const handleThemeChange = (event, theme) => {
      if (appState.theme === 'system') {
        document.documentElement.classList.remove('dark', 'light')
        document.documentElement.classList.add(theme)
      }
    }

    window.electronAPI?.window?.onThemeChanged(handleThemeChange)
    return () => {
      window.electronAPI?.window?.removeThemeListener(handleThemeChange)
    }
  }, [appState.theme])

  // Single useEffect for Electron detection
  useEffect(() => {
    const isElectron = typeof window !== 'undefined' && !!window.electronAPI
    if (isElectron !== appState.isElectron) {
      updateAppState({ isElectron })
    }
  }, [appState.isElectron])

  return (
    <AppStateContext.Provider value={{ appState, updateAppState, resetTranscription, clearAll }}>
      {children}
    </AppStateContext.Provider>
  )
}

function AppContent() {
  const { appState } = useAppState()
  const [activeTab, setActiveTab] = useState('transcribe')

  // Platform detection
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI
  const isMacOS = window.platform?.isMacOS || window.platform?.os === 'darwin'

  // Choose the appropriate transcription component
  const TranscriptionComponent = appState.isElectron ? TranscriptionTabElectron : TranscriptionTab

  return (
    <div className={`min-h-screen bg-background flex flex-col ${isMacOS ? 'platform-macos' : ''}`}>
      <Toaster />
      
      <header className="sticky top-0 w-full backdrop-blur-[20px] z-50 mb-4">
        <div className="glass-header relative">
          <div className="h-[64px] px-4">
            <div className={`header-content ${isMacOS ? 'macos' : ''}`}>
              <div className="header-logo-section">
                <div className="frosted-glass p-2 rounded-lg shadow-lg">
                  <Mic className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">WhisperDesk Enhanced</h1>
                  {appState.isElectron && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded inline-block mt-1">
                      Electron
                    </span>
                  )}
                </div>
              </div>
              
              <div className="header-controls">
                <AppStateIndicator />
                {/* Only show custom window controls on non-macOS platforms */}
                {appState.isElectron && !isMacOS && <WindowControls />}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="transcribe" className="flex items-center space-x-2">
              <Mic className="w-4 h-4" />
              <span>Transcribe</span>
              <FileIndicator />
            </TabsTrigger>
            <TabsTrigger value="models" className="flex items-center space-x-2">
              <Package className="w-4 h-4" />
              <span>Models</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>History</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Contents */}
          <TabsContent value="transcribe" className="space-y-6">
            <TranscriptionComponent />
          </TabsContent>

          <TabsContent value="models" className="space-y-6">
            <ModelMarketplace />
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <HistoryTab />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <SettingsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

// Main App component
const App = () => {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  )
}

export default App

// Helper Components
function FileIndicator() {
  const { appState } = useAppState()
  
  if (appState.selectedFile) {
    return (
      <span className="w-2 h-2 bg-primary rounded-full" title={`File selected: ${appState.selectedFile.name}`} />
    )
  }
  
  return null
}

function AppStateIndicator() {
  const { appState } = useAppState()
  
  return (
    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
      {appState.selectedFile && (
        <span className="bg-primary/10 text-primary px-2 py-1 rounded">
          {appState.selectedFile.name}
        </span>
      )}
      {appState.isTranscribing && (
        <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded animate-pulse">
          Transcribing...
        </span>
      )}
      {appState.transcription && !appState.isTranscribing && (
        <span className="bg-green-100 text-green-600 px-2 py-1 rounded">
          ✓ Complete
        </span>
      )}
    </div>
  )
}

function HistoryTab() {
  const { appState, clearAll } = useAppState()
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcription History</CardTitle>
        <CardDescription>
          View your current session and past transcriptions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Session */}
        {appState.selectedFile || appState.transcription ? (
          <div className="space-y-4">
            <h3 className="font-medium">Current Session</h3>
            
            {appState.selectedFile && (
              <div className="p-3 border rounded-lg">
                <div className="font-medium">Selected File</div>
                <div className="text-sm text-muted-foreground">{appState.selectedFile.name}</div>
                {appState.selectedFile.size && (
                  <div className="text-xs text-muted-foreground">
                    {(appState.selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                )}
              </div>
            )}
            
            {appState.transcription && (
              <div className="p-3 border rounded-lg">
                <div className="font-medium">Latest Transcription</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {appState.transcription.substring(0, 100)}
                  {appState.transcription.length > 100 ? '...' : ''}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {appState.transcription.length} characters
                </div>
              </div>
            )}
            
            <Button onClick={clearAll} variant="outline" size="sm">
              Clear Session
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">No transcriptions yet in this session</p>
        )}
        
        {/* Placeholder for persistent history */}
        <div className="pt-4 border-t">
          <h3 className="font-medium mb-2">Saved History</h3>
          <p className="text-sm text-muted-foreground">
            Persistent history across sessions coming soon...
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function WindowControls() {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  
  // Enhanced platform detection with debugging
  const platformInfo = {
    electronAPI: !!window.electronAPI,
    platform: window.platform,
    electronPlatform: window.electronAPI?.platform,
    userAgent: navigator.userAgent,
    // Multiple ways to detect macOS
    isMacOS1: window.platform?.isMacOS,
    isMacOS2: window.platform?.os === 'darwin',
    isMacOS3: window.electronAPI?.platform === 'darwin',
    isMacOS4: navigator.userAgent.includes('Mac'),
    finalDetection: window.platform?.isMacOS || window.platform?.os === 'darwin' || window.electronAPI?.platform === 'darwin'
  };
  
  // Log platform info for debugging
  React.useEffect(() => {
    console.log('WindowControls Platform Detection:', platformInfo);
  }, []);
  
  const isMacOS = platformInfo.finalDetection;
  const [isMaximized, setIsMaximized] = React.useState(false);

  React.useEffect(() => {
    if (isElectron) {
      const handleMaximize = () => {
        console.log('Window maximized event received');
        setIsMaximized(true);
      };
      const handleUnmaximize = () => {
        console.log('Window unmaximized event received');
        setIsMaximized(false);
      };

      // Check if the methods exist before calling them
      if (window.electronAPI?.window?.onMaximize) {
        window.electronAPI.window.onMaximize(handleMaximize);
      } else {
        console.warn('window.electronAPI.window.onMaximize not available');
      }
      
      if (window.electronAPI?.window?.onUnmaximize) {
        window.electronAPI.window.onUnmaximize(handleUnmaximize);
      } else {
        console.warn('window.electronAPI.window.onUnmaximize not available');
      }

      return () => {
        if (window.electronAPI?.window?.removeMaximizeListener) {
          window.electronAPI.window.removeMaximizeListener(handleMaximize);
        }
        if (window.electronAPI?.window?.removeUnmaximizeListener) {
          window.electronAPI.window.removeUnmaximizeListener(handleUnmaximize);
        }
      };
    }
  }, [isElectron]);

  // Debug: Always show some info about platform detection
  console.log('WindowControls render - isMacOS:', isMacOS, 'isElectron:', isElectron);

  // Hide custom controls on macOS since we're using native traffic lights
  if (isMacOS || !isElectron) {
    console.log('WindowControls hidden because:', { isMacOS, isElectron });
    return (
      <div className="text-xs text-muted-foreground">
        {/* Debug info - remove this in production */}
        Platform: {window.platform?.os || 'unknown'} | Electron: {isElectron ? 'yes' : 'no'} | macOS: {isMacOS ? 'yes' : 'no'}
      </div>
    );
  }

  const handleMinimize = () => {
    console.log('Minimize clicked');
    if (window.electronAPI?.window?.minimize) {
      window.electronAPI.window.minimize();
    } else {
      console.error('window.electronAPI.window.minimize not available');
    }
  };

  const handleMaximize = () => {
    console.log('Maximize clicked');
    if (window.electronAPI?.window?.maximize) {
      window.electronAPI.window.maximize();
    } else {
      console.error('window.electronAPI.window.maximize not available');
    }
  };

  const handleClose = () => {
    console.log('Close clicked');
    if (window.electronAPI?.window?.close) {
      window.electronAPI.window.close();
    } else {
      console.error('window.electronAPI.window.close not available');
    }
  };

  return (
    <div className="title-bar">
      <div className="window-controls">
        <button
          onClick={handleMinimize}
          className="window-control-button"
          aria-label="Minimize window"
          title="Minimize"
        >
          <svg viewBox="0 0 10 10">
            <path d="M0,5h10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          onClick={handleMaximize}
          className="window-control-button"
          aria-label={isMaximized ? "Restore window" : "Maximize window"}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          <svg viewBox="0 0 10 10">
            {isMaximized ? (
              <path d="M2.5,2.5v5h5v-5H2.5z M2,5l3-3" stroke="currentColor" strokeWidth="1" fill="none"/>
            ) : (
              <path d="M0,0v10h10v-10H0z" stroke="currentColor" strokeWidth="1" fill="none"/>
            )}
          </svg>
        </button>
        <button
          onClick={handleClose}
          className="window-control-button close"
          aria-label="Close window"
          title="Close"
        >
          <svg viewBox="0 0 10 10">
            <path d="M0,0L10,10M10,0L0,10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Add this component temporarily to your App.jsx to debug platform detection
function PlatformDebugInfo() {
  const [debugInfo, setDebugInfo] = React.useState(null);
  
  React.useEffect(() => {
    const info = {
      // Electron detection
      hasElectronAPI: !!window.electronAPI,
      electronAPIKeys: window.electronAPI ? Object.keys(window.electronAPI) : [],
      
      // Platform detection methods
      platform: {
        exists: !!window.platform,
        data: window.platform,
        os: window.platform?.os,
        isMacOS: window.platform?.isMacOS,
        isWindows: window.platform?.isWindows,
        isLinux: window.platform?.isLinux
      },
      
      // Alternative platform detection
      electronPlatform: window.electronAPI?.platform,
      userAgent: navigator.userAgent,
      
      // Navigator platform (less reliable)
      navigatorPlatform: navigator.platform,
      
      // Final decision logic
      finalIsMacOS: window.platform?.isMacOS || window.platform?.os === 'darwin' || window.electronAPI?.platform === 'darwin',
      
      // Window controls availability
      windowControls: {
        minimize: !!window.electronAPI?.window?.minimize,
        maximize: !!window.electronAPI?.window?.maximize,
        close: !!window.electronAPI?.window?.close,
        onMaximize: !!window.electronAPI?.window?.onMaximize,
        onUnmaximize: !!window.electronAPI?.window?.onUnmaximize
      }
    };
    
    setDebugInfo(info);
    console.log('Platform Debug Info:', info);
  }, []);
  
  if (!debugInfo) return <div>Loading debug info...</div>;
  
  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-md z-50">
      <h3 className="font-bold mb-2">Platform Debug Info</h3>
      <div className="space-y-1">
        <div>Electron: {debugInfo.hasElectronAPI ? '✅' : '❌'}</div>
        <div>Platform object: {debugInfo.platform.exists ? '✅' : '❌'}</div>
        <div>OS: {debugInfo.platform.os || 'unknown'}</div>
        <div>Is macOS: {debugInfo.finalIsMacOS ? '✅' : '❌'}</div>
        <div>Window controls: {Object.values(debugInfo.windowControls).every(Boolean) ? '✅' : '❌'}</div>
        <div>User Agent: {debugInfo.userAgent.substring(0, 50)}...</div>
        
        <button 
          onClick={() => {
            if (window.electronAPI?.debug?.testIPC) {
              window.electronAPI.debug.testIPC().then(result => {
                console.log('IPC Test Result:', result);
                alert('IPC Test: ' + JSON.stringify(result, null, 2));
              }).catch(error => {
                console.error('IPC Test Error:', error);
                alert('IPC Test Error: ' + error.message);
              });
            } else {
              alert('IPC test not available');
            }
          }}
          className="mt-2 bg-blue-600 px-2 py-1 rounded text-white"
        >
          Test IPC
        </button>
      </div>
    </div>
  );
}