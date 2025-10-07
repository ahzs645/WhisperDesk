import React, { useState, useEffect } from 'react'
import { Button } from '@repo/ui/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Label } from '@repo/ui/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/ui/select'
import { Switch } from '@repo/ui/components/ui/switch'
import { Settings, Moon, Sun, Laptop } from 'lucide-react'
import { toast } from 'sonner'
import { invoke } from '@repo/ui/lib/mock-tauri-api'
import { useAppState } from '../App'

export function SettingsTab() {
  const { theme, updateTheme, appInfo } = useAppState()
  const [autoSave, setAutoSave] = useState(true)
  const [language, setLanguage] = useState('en')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await invoke('get_all_settings')
      if (settings.autoSave !== undefined) setAutoSave(settings.autoSave)
      if (settings.language) setLanguage(settings.language)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const handleThemeChange = (newTheme: string) => {
    updateTheme(newTheme)
    toast.success(`Theme changed to ${newTheme}`)
  }

  const handleAutoSaveToggle = async (checked: boolean) => {
    setAutoSave(checked)
    await invoke('set_setting', { key: 'autoSave', value: checked })
    toast.success(`Auto-save ${checked ? 'enabled' : 'disabled'}`)
  }

  const handleLanguageChange = async (newLang: string) => {
    setLanguage(newLang)
    await invoke('set_setting', { key: 'language', value: newLang })
    toast.success(`Language changed to ${newLang}`)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </CardTitle>
          <CardDescription>
            Configure WhisperDesk to your preferences
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Appearance</CardTitle>
          <CardDescription>
            Customize how WhisperDesk looks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">
                Choose your preferred color scheme
              </p>
            </div>
            <Select value={theme} onValueChange={handleThemeChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Light
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Dark
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-4 w-4" />
                    System
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">General</CardTitle>
          <CardDescription>
            General application settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-save</Label>
              <p className="text-sm text-muted-foreground">
                Automatically save transcriptions
              </p>
            </div>
            <Switch checked={autoSave} onCheckedChange={handleAutoSaveToggle} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Language</Label>
              <p className="text-sm text-muted-foreground">
                Default transcription language
              </p>
            </div>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Version</span>
            <span className="font-mono">{appInfo?.version}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Platform</span>
            <span>{appInfo?.platform}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Framework</span>
            <span>Tauri v2</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
