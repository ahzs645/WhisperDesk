// src/renderer/whisperdesk-ui/src/App.jsx - With persistent file state
import { useState, useEffect, createContext, useContext } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Mic, Package, Clock, Settings } from 'lucide-react'
import { ModelMarketplace } from '@/components/ModelMarketplace-WebCompatible'
import { TranscriptionTab } from '@/components/TranscriptionTab-WebCompatible'
import { TranscriptionTabElectron } from '@/components/TranscriptionTab-Electron'
import { Toaster } from 'sonner'
import './App.css'

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
  // Persistent state that survives tab switches
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
    
    // Results state
    lastTranscriptionResult: null,
    
    // Environment
    isElectron: false
  })

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

  const value = {
    appState,
    updateAppState,
    resetTranscription,
    clearAll
  }

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('transcribe')

  useEffect(() => {
    // Detect if we're running in Electron and update global state
    const isElectron = typeof window !== 'undefined' && window.electronAPI
    
    // We can't use useAppState here since this component provides the context
    // Instead, we'll pass this down or detect it in each component
  }, [])

  // Choose the appropriate transcription component
  const isElectron = typeof window !== 'undefined' && window.electronAPI
  const TranscriptionComponent = isElectron ? TranscriptionTabElectron : TranscriptionTab

  return (
    <AppStateProvider>
      <div className="min-h-screen bg-background">
        {/* Toast notifications */}
        <Toaster />
        
        {/* Header */}
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mic className="w-8 h-8 text-primary" />
                <h1 className="text-xl font-bold">WhisperDesk Enhanced</h1>
                {isElectron && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    Electron
                  </span>
                )}
              </div>
              
              {/* Quick actions in header */}
              <div className="flex items-center space-x-2">
                <AppStateIndicator />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6">
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

            {/* Transcription Tab */}
            <TabsContent value="transcribe" className="space-y-6">
              <TranscriptionComponent />
            </TabsContent>

            {/* Models Tab */}
            <TabsContent value="models" className="space-y-6">
              <ModelMarketplace />
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-6">
              <HistoryTab />
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <SettingsTab />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AppStateProvider>
  )
}

// Component to show file selection indicator in tab
function FileIndicator() {
  const { appState } = useAppState()
  
  if (appState.selectedFile) {
    return (
      <span className="w-2 h-2 bg-primary rounded-full" title={`File selected: ${appState.selectedFile.name}`} />
    )
  }
  
  return null
}

// Component to show app state in header
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

// Enhanced History Tab with persistent state
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

// Enhanced Settings Tab
function SettingsTab() {
  const { appState, updateAppState } = useAppState()
  const isElectron = typeof window !== 'undefined' && window.electronAPI
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Configure your preferences and view current state
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Environment Info */}
          <div className="space-y-2">
            <h4 className="font-medium">Environment</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Platform:</span>
                <span className="font-mono">{isElectron ? 'Electron App' : 'Web Browser'}</span>
              </div>
              <div className="flex justify-between">
                <span>Provider:</span>
                <span className="font-mono">{appState.selectedProvider}</span>
              </div>
              <div className="flex justify-between">
                <span>Model:</span>
                <span className="font-mono">{appState.selectedModel}</span>
              </div>
            </div>
          </div>
          
          {/* Electron API Status */}
          {isElectron && (
            <div className="space-y-2">
              <h4 className="font-medium">Electron API Status</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Model API:</span>
                  <span>{window.electronAPI?.model ? '✅' : '❌'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transcription API:</span>
                  <span>{window.electronAPI?.transcription ? '✅' : '❌'}</span>
                </div>
                <div className="flex justify-between">
                  <span>File API:</span>
                  <span>{window.electronAPI?.file ? '✅' : '❌'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Export API:</span>
                  <span>{window.electronAPI?.export ? '✅' : '❌'}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Current Session State */}
          <div className="space-y-2">
            <h4 className="font-medium">Session State</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>File Selected:</span>
                <span>{appState.selectedFile ? '✅' : '❌'}</span>
              </div>
              <div className="flex justify-between">
                <span>Transcribing:</span>
                <span>{appState.isTranscribing ? '🔄' : '⏸️'}</span>
              </div>
              <div className="flex justify-between">
                <span>Has Result:</span>
                <span>{appState.transcription ? '✅' : '❌'}</span>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            More settings options coming soon...
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default App