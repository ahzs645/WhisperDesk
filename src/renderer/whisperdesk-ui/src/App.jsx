// src/renderer/whisperdesk-ui/src/App.jsx - FIXED: Added Recording Indicator
import React, { useState, useEffect, createContext, useContext } from 'react'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Progress } from './components/ui/progress'
import { Mic, Package, Clock, Settings, Video, BarChart3 } from 'lucide-react'
import { ModelMarketplace } from './components/ModelMarketplace-WebCompatible'
import { AnalyticsTab } from './components/AnalyticsTab'
import { EnhancedTranscriptionTab } from './components/EnhancedTranscriptDisplay'
import { EnhancedSettingsTab } from './components/EnhancedSettingsTab'
import { UnifiedWindowControls } from './components/UnifiedWindowControls'
import { Toaster } from './components/ui/sonner'
import { appInitializer } from './utils/AppInitializer'
import './App.css'

// Create contexts for app-wide state and initialization
const AppStateContext = createContext()
const InitializationContext = createContext()

export const useAppState = () => {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider')
  }
  return context
}

export const useInitialization = () => {
  const context = useContext(InitializationContext)
  if (!context) {
    throw new Error('useInitialization must be used within InitializationProvider')
  }
  return context
}

// Theme management
const useThemeManager = () => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'system'
  })

  const applyThemeToDOM = (themeValue) => {
    document.documentElement.classList.remove('dark', 'light')
    
    let effectiveTheme = themeValue
    
    if (themeValue === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      effectiveTheme = systemPrefersDark ? 'dark' : 'light'
    }
    
    if (effectiveTheme === 'dark') {
      document.documentElement.classList.add('dark')
    }
  }

  useEffect(() => {
    applyThemeToDOM(theme)
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = () => {
      if (theme === 'system') {
        applyThemeToDOM('system')
      }
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [theme])

  const updateTheme = (newTheme) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    
    if (window.electronAPI?.window?.setTheme) {
      window.electronAPI.window.setTheme(newTheme)
    }
  }

  return { theme, updateTheme }
}

function InitializationProvider({ children }) {
  const [initializationState, setInitializationState] = useState({
    isInitializing: false,
    isInitialized: false,
    progress: 0,
    step: '',
    error: null
  })

  const initialize = async (updateAppState) => {
    if (initializationState.isInitializing || initializationState.isInitialized) {
      console.log('🔒 App already initialized/initializing, skipping...')
      return
    }

    setInitializationState(prev => ({ ...prev, isInitializing: true }))

    try {
      await appInitializer.initialize(
        updateAppState,
        (progress) => setInitializationState(prev => ({ ...prev, ...progress }))
      )
      
      setInitializationState(prev => ({
        ...prev,
        isInitializing: false,
        isInitialized: true,
        progress: 100,
        step: 'Ready!'
      }))
    } catch (error) {
      console.error('❌ App initialization failed:', error)
      setInitializationState(prev => ({
        ...prev,
        isInitializing: false,
        error: error.message
      }))
    }
  }

  const cleanup = () => {
    appInitializer.cleanup()
    setInitializationState({
      isInitializing: false,
      isInitialized: false,
      progress: 0,
      step: '',
      error: null
    })
  }

  return (
    <InitializationContext.Provider value={{
      ...initializationState,
      initialize,
      cleanup
    }}>
      {children}
    </InitializationContext.Provider>
  )
}

function AppStateProvider({ children }) {
  const { theme, updateTheme } = useThemeManager()
  const { initialize } = useInitialization()
  
  const [appState, setAppState] = useState({
    selectedFile: null,
    transcription: '',
    isTranscribing: false,
    progress: 0,
    progressMessage: '',
    activeTranscriptionId: null,
    selectedProvider: 'whisper-native',
    selectedModel: 'whisper-tiny',
    isRecording: false,
    recordingDuration: 0,
    recordingValidated: false,
    recordingSettings: {
      includeMicrophone: true,
      includeSystemAudio: true
    },
    lastTranscriptionResult: null,
    isElectron: false,
    theme: theme
  })

  useEffect(() => {
    setAppState(prev => ({ ...prev, theme }))
  }, [theme])

  const updateAppState = (updates) => {
    if (typeof updates.theme !== 'undefined') {
      updateTheme(updates.theme)
      const { theme: _, ...otherUpdates } = updates
      updates = otherUpdates
    }
    
    setAppState(prev => ({ ...prev, ...updates }))
  }

  const resetTranscription = () => {
    updateAppState({
      transcription: '',
      isTranscribing: false,
      progress: 0,
      progressMessage: '',
      lastTranscriptionResult: null,
      activeTranscriptionId: null
    })
  }

  const clearAll = () => {
    setAppState(prev => ({
      ...prev,
      selectedFile: null,
      transcription: '',
      isTranscribing: false,
      progress: 0,
      progressMessage: '',
      lastTranscriptionResult: null,
      activeTranscriptionId: null,
      isRecording: false,
      recordingDuration: 0,
      recordingValidated: false
    }))
  }

  useEffect(() => {
    const isElectron = typeof window !== 'undefined' && !!window.electronAPI
    if (isElectron !== appState.isElectron) {
      updateAppState({ isElectron })
    }
  }, [appState.isElectron])

  // Initialize app when mounted
  useEffect(() => {
    initialize(updateAppState)
  }, [])

  return (
    <AppStateContext.Provider value={{ 
      appState, 
      updateAppState, 
      resetTranscription, 
      clearAll,
      updateTheme
    }}>
      {children}
    </AppStateContext.Provider>
  )
}

// App content component
function AppContent() {
  const { appState } = useAppState()
  const { isInitializing, isInitialized, progress, step, error } = useInitialization()
  const [platform, setPlatform] = useState('unknown')

  useEffect(() => {
    // Detect platform
    window.electronAPI?.window?.getPlatform?.().then(platformInfo => {
      setPlatform(platformInfo)
    })
  }, [])

  const isMacOS = platform === 'darwin'

  // Show loading state while initializing
  if (isInitializing || !isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Initializing WhisperDesk</CardTitle>
            <CardDescription>{step}</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="mb-4" />
            {error && (
              <div className="text-red-500 text-sm mt-2">
                Error: {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toaster 
        position="bottom-right"
        expand={false}
        richColors={true}
        closeButton={true}
        duration={4000}
        visibleToasts={4}
        gap={12}
        offset={16}
      />
      
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="transcribe" className="flex items-center space-x-2">
              <Mic className="w-4 h-4" />
              <span>Transcribe</span>
              <FileIndicator />
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Analytics</span>
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
            <EnhancedTranscriptionTab />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsTab />
          </TabsContent>

          <TabsContent value="models" className="space-y-6">
            <ModelMarketplace />
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <HistoryTab />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <EnhancedSettingsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

// Main App component
const App = () => {
  return (
    <InitializationProvider>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </InitializationProvider>
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

// 🔴 ENHANCED: Added recording status with breathing animation
function AppStateIndicator() {
  const { appState } = useAppState()
  
  return (
    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
      {/* 🔴 PRIORITY: Recording status - most important */}
      {appState.isRecording && (
        <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded animate-pulse flex items-center">
          <Video className="w-3 h-3 mr-1" />
          {appState.recordingValidated ? 'Recording' : 'Starting...'}
          {appState.recordingDuration > 0 && ` ${formatDuration(appState.recordingDuration)}`}
        </span>
      )}
      
      {/* Selected file indicator */}
      {appState.selectedFile && !appState.isRecording && (
        <span className="bg-primary/10 text-primary px-2 py-1 rounded">
          {appState.selectedFile.name}
        </span>
      )}
      
      {/* Transcribing status */}
      {appState.isTranscribing && (
        <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-1 rounded animate-pulse">
          Transcribing...
        </span>
      )}
      
      {/* Completion status */}
      {appState.transcription && !appState.isTranscribing && !appState.isRecording && (
        <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded">
          ✓ Complete
        </span>
      )}
    </div>
  )
}

// 🔴 ADDED: Duration formatter
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
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