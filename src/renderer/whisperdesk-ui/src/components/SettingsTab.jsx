import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useAppState } from '../App'
import { useEffect } from 'react'

export function SettingsTab() {
  const { appState, updateAppState } = useAppState()
  const isElectron = typeof window !== 'undefined' && window.electronAPI

  // Apply theme changes
  useEffect(() => {
    const applyTheme = (theme) => {
      // Remove existing theme classes
      document.documentElement.classList.remove('dark', 'light')
      
      if (theme === 'system') {
        // For system theme, we'll let the system handle it
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        document.documentElement.classList.add(systemTheme)
      } else {
        // For explicit themes, apply them directly
        document.documentElement.classList.add(theme)
      }
    }

    // Apply initial theme
    applyTheme(appState.theme)

    // Listen for system theme changes if using system theme
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = (e) => {
      if (appState.theme === 'system') {
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }, [appState.theme])

  const handleThemeChange = (value) => {
    // Update app state
    updateAppState({ theme: value })
    
    // Persist theme preference
    localStorage.setItem('theme', value)
    
    // Send theme to main process if in Electron
    if (isElectron && window.electronAPI?.window?.setTheme) {
      window.electronAPI.window.setTheme(value)
    }
  }
  
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
          {/* Theme Settings */}
          <div className="grid gap-2">
            <Label htmlFor="theme">Theme</Label>
            <Select
              id="theme"
              value={appState.theme}
              onValueChange={handleThemeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          {/* Debug Information */}
          <div className="space-y-2">
            <h4 className="font-medium">Debug Information</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between items-center">
                <span>Electron API:</span>
                <span className={`px-2 py-1 rounded font-mono ${
                  isElectron 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {isElectron ? 'Available' : 'Not Available'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Screen Recorder:</span>
                <span className={`px-2 py-1 rounded font-mono ${
                  isElectron && window.electronAPI?.screenRecorder
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {isElectron && window.electronAPI?.screenRecorder ? 'Available' : 'Not Available'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Current Theme:</span>
                <span className={`px-2 py-1 rounded font-mono ${
                  appState.theme === 'dark'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    : appState.theme === 'light'
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {appState.theme}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Recording State:</span>
                <span className={`px-2 py-1 rounded font-mono ${
                  appState.isRecording
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {appState.isRecording ? 'Recording' : 'Not Recording'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Transcription State:</span>
                <span className={`px-2 py-1 rounded font-mono ${
                  appState.isTranscribing
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {appState.isTranscribing ? 'Transcribing' : 'Not Transcribing'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 