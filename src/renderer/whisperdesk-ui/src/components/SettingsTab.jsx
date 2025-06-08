import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { toast } from 'sonner'
import { useAppState } from '../App'

function ToastTestSection() {
  const testMultipleToasts = () => {
    // Fire multiple toasts quickly to test stacking
    toast.success('✅ Success toast 1')
    setTimeout(() => toast.error('❌ Error toast 2'), 100)
    setTimeout(() => toast.warning('⚠️ Warning toast 3'), 200)
    setTimeout(() => toast.info('ℹ️ Info toast 4'), 300)
    setTimeout(() => toast.loading('⏳ Loading toast 5'), 400)
  }

  const testLongMessages = () => {
    toast.success('✅ This is a really long success message that should wrap properly and not break the stacking layout')
    setTimeout(() => {
      toast.error('❌ This is an even longer error message that contains multiple lines of text and should demonstrate how the toast stacking handles different heights automatically without breaking')
    }, 200)
  }

  const testDifferentDurations = () => {
    toast.success('Short message (2s)', { duration: 2000 })
    setTimeout(() => {
      toast.warning('Medium message (5s)', { duration: 5000 })
    }, 100)
    setTimeout(() => {
      toast.info('Long message (10s)', { duration: 10000 })
    }, 200)
  }

  return (
    <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
      <h4 className="font-medium">Toast Stacking Test</h4>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={testMultipleToasts}>
          Test Multiple Toasts
        </Button>
        <Button size="sm" onClick={testLongMessages}>
          Test Long Messages
        </Button>
        <Button size="sm" onClick={testDifferentDurations}>
          Test Different Durations
        </Button>
        <Button size="sm" variant="destructive" onClick={() => toast.dismiss()}>
          Dismiss All
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Use these buttons to test if toast stacking is working properly.
        Multiple toasts should stack vertically and animate smoothly.
      </p>
    </div>
  )
}

export function SettingsTab() {
  const { appState, updateTheme } = useAppState() // Use updateTheme directly
  const isElectron = typeof window !== 'undefined' && window.electronAPI

  // FIXED: Simplified theme change handler
  const handleThemeChange = (value) => {
    console.log('🎨 Settings: Theme change requested:', value)
    
    // Use the updateTheme function from the theme manager
    updateTheme(value)
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
          {/* Add toast test section temporarily */}
          <ToastTestSection />

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
            {/* Add current theme indicator for debugging */}
            <div className="text-xs text-muted-foreground">
              Current: {appState.theme} | DOM classes: {document.documentElement.className || 'none'}
            </div>
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
              <div className="flex justify-between">
                <span>System Prefers Dark:</span>
                <span className="font-mono">
                  {window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Yes' : 'No'}
                </span>
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