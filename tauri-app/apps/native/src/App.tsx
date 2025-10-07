// WhisperDesk Tauri App - Main Component
import React, { useState, useEffect, createContext, useContext } from 'react'
import { Button } from '@repo/ui/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'
import { Progress } from '@repo/ui/components/ui/progress'
import { Mic, Package, BarChart3, Video, Settings as SettingsIcon } from 'lucide-react'
import { Toaster } from '@repo/ui/components/ui/sonner'
import { invoke } from '@repo/ui/lib/mock-tauri-api'
import '@repo/ui/App.css'

// Import tabs (we'll create simplified versions)
import { TranscriptionTab } from './components/TranscriptionTab'
import { ModelsTab } from './components/ModelsTab'
import { AnalyticsTab } from './components/AnalyticsTab'
import { ScreenRecorderTab } from './components/ScreenRecorderTab'
import { SettingsTab } from './components/SettingsTab'

// Create contexts for app-wide state
const AppStateContext = createContext<any>(null)

export const useAppState = () => {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider')
  }
  return context
}

// Theme management
const useThemeManager = () => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark'
  })

  const applyThemeToDOM = (themeValue: string) => {
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

  const updateTheme = (newTheme: string) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)

    // Call Tauri backend to update theme
    invoke('set_setting', { key: 'theme', value: newTheme }).catch(console.error)
  }

  return { theme, updateTheme }
}

function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { theme, updateTheme } = useThemeManager()
  const [appInfo, setAppInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize app state
  useEffect(() => {
    const init = async () => {
      try {
        const info = await invoke('get_app_info')
        setAppInfo(info)

        // Load saved theme
        const savedTheme = await invoke('get_setting', { key: 'theme' })
        if (savedTheme) {
          updateTheme(savedTheme)
        }
      } catch (error) {
        console.error('Failed to initialize app:', error)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  const value = {
    theme,
    updateTheme,
    appInfo,
    isLoading,
  }

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  )
}

function App() {
  const { isLoading, appInfo } = useAppState()
  const [activeTab, setActiveTab] = useState('transcription')

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Loading WhisperDesk...</CardTitle>
            <CardDescription>Initializing application</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={65} className="w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="h-6 w-6" />
              <h1 className="text-2xl font-bold">WhisperDesk</h1>
              {appInfo && (
                <span className="text-sm text-muted-foreground">
                  v{appInfo.version} • {appInfo.platform}
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              🎉 Running with Tauri + Mock API
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="transcription" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Transcribe
            </TabsTrigger>
            <TabsTrigger value="models" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Models
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="recorder" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Recorder
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transcription" className="mt-6">
            <TranscriptionTab />
          </TabsContent>

          <TabsContent value="models" className="mt-6">
            <ModelsTab />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <AnalyticsTab />
          </TabsContent>

          <TabsContent value="recorder" className="mt-6">
            <ScreenRecorderTab />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <SettingsTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Toast notifications */}
      <Toaster />
    </div>
  )
}

// Wrap App with providers
export default function WrappedApp() {
  return (
    <AppStateProvider>
      <App />
    </AppStateProvider>
  )
}
