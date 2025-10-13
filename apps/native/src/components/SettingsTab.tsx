import React, { useState, useEffect } from 'react'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Label } from '@repo/ui/components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { Switch } from '@repo/ui/components/switch'
import { Settings, Moon, Sun, Laptop } from 'lucide-react'
import { toast } from 'sonner'
import { invoke } from '@repo/ui/lib/mock-tauri-api'
import { useAppState } from '../App'

export function SettingsTab() {
  const { theme, updateTheme, appInfo } = useAppState()
  const [autoSave, setAutoSave] = useState(true)
  const [language, setLanguage] = useState('en')
  const [autoDetectLanguage, setAutoDetectLanguage] = useState(true)
  const [enableTimestamps, setEnableTimestamps] = useState(true)
  const [enableSpeakerDiarization, setEnableSpeakerDiarization] = useState(false)
  const [maxSpeakers, setMaxSpeakers] = useState(10)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      // Load from localStorage for transcription settings
      const settingsStr = localStorage.getItem('whisperdesk_settings')
      if (settingsStr) {
        const settings = JSON.parse(settingsStr)
        if (settings.autoDetectLanguage !== undefined) setAutoDetectLanguage(settings.autoDetectLanguage)
        if (settings.enableTimestamps !== undefined) setEnableTimestamps(settings.enableTimestamps)
        if (settings.enableSpeakerDiarization !== undefined) setEnableSpeakerDiarization(settings.enableSpeakerDiarization)
        if (settings.maxSpeakers !== undefined) setMaxSpeakers(settings.maxSpeakers)
      }

      // Load app settings from Tauri
      const appSettings = await invoke('get_all_settings')
      if (appSettings.autoSave !== undefined) setAutoSave(appSettings.autoSave)
      if (appSettings.language) setLanguage(appSettings.language)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const saveTranscriptionSetting = (key: string, value: any) => {
    console.log('=== SAVING SETTING ===')
    console.log('Key:', key)
    console.log('Value:', value)
    const settingsStr = localStorage.getItem('whisperdesk_settings')
    console.log('Current settings:', settingsStr)
    const settings = settingsStr ? JSON.parse(settingsStr) : {}
    settings[key] = value
    console.log('Updated settings:', settings)
    localStorage.setItem('whisperdesk_settings', JSON.stringify(settings))
    console.log('Saved to localStorage!')
    console.log('=====================')
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

      {/* Transcription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transcription</CardTitle>
          <CardDescription>
            Configure transcription behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-detect Language</Label>
              <p className="text-sm text-muted-foreground">
                Automatically identify the spoken language
              </p>
            </div>
            <Switch
              checked={autoDetectLanguage}
              onCheckedChange={(checked) => {
                setAutoDetectLanguage(checked)
                saveTranscriptionSetting('autoDetectLanguage', checked)
                toast.success(`Auto-detect language ${checked ? 'enabled' : 'disabled'}`)
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Timestamps</Label>
              <p className="text-sm text-muted-foreground">
                Include timing information in transcripts
              </p>
            </div>
            <Switch
              checked={enableTimestamps}
              onCheckedChange={(checked) => {
                setEnableTimestamps(checked)
                saveTranscriptionSetting('enableTimestamps', checked)
                toast.success(`Timestamps ${checked ? 'enabled' : 'disabled'}`)
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Speaker Diarization</Label>
              <p className="text-sm text-muted-foreground">
                Automatically identify different speakers
              </p>
            </div>
            <Switch
              checked={enableSpeakerDiarization}
              onCheckedChange={(checked) => {
                setEnableSpeakerDiarization(checked)
                saveTranscriptionSetting('enableSpeakerDiarization', checked)
                toast.success(`Speaker diarization ${checked ? 'enabled' : 'disabled'}`)
              }}
            />
          </div>

          {enableSpeakerDiarization && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Maximum Speakers</Label>
                <p className="text-sm text-muted-foreground">
                  Expected number of speakers
                </p>
              </div>
              <Select
                value={String(maxSpeakers)}
                onValueChange={(value) => {
                  const num = parseInt(value)
                  setMaxSpeakers(num)
                  saveTranscriptionSetting('maxSpeakers', num)
                  toast.success(`Max speakers set to ${num}`)
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 8, 10].map(num => (
                    <SelectItem key={num} value={String(num)}>{num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
