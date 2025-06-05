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
import { UnifiedWindowControls } from './components/UnifiedWindowControls'
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

// App content component
function AppContent() {
  const { appState } = useAppState();
  const [platform, setPlatform] = useState('unknown');

  useEffect(() => {
    // Detect platform
    window.electronAPI?.window?.getPlatform?.().then(platformInfo => {
      setPlatform(platformInfo);
    });
  }, []);

  const isMacOS = platform === 'darwin';

  // Choose the appropriate transcription component
  const TranscriptionComponent = appState.isElectron ? TranscriptionTabElectron : TranscriptionTab

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toaster position="bottom-right" />
      
      <header className="unified-header">
        <div className="unified-header-content">
          {/* macOS: Controls on the left */}
          {isMacOS && appState.isElectron && (
            <div className="header-section header-left">
              <UnifiedWindowControls />
            </div>
          )}
          
          {/* Center content */}
          <div className={`header-section header-center ${isMacOS ? 'macos-center' : ''}`}>
            <div className="flex items-center space-x-3">
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
          </div>
          
          {/* Right side: Status indicator and controls */}
          <div className="header-section header-right">
            <div className="flex items-center space-x-3">
              {/* Add back the status indicator */}
              <AppStateIndicator />
              
              {/* Windows/Linux: Controls on the right */}
              {!isMacOS && appState.isElectron && (
                <UnifiedWindowControls />
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 container mx-auto py-6">
        <Tabs defaultValue="transcribe" className="w-full">
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
        <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-1 rounded animate-pulse">
          Transcribing...
        </span>
      )}
      {appState.transcription && !appState.isTranscribing && (
        <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded">
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