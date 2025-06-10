// src/renderer/whisperdesk-ui/src/components/EnhancedSettingsTab.jsx
import React, { useState } from 'react';
import { useAppState } from '@/App';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderOpen, Settings } from 'lucide-react';
import { toast } from 'sonner';

export function EnhancedSettingsTab() {
  const { appState, updateTheme } = useAppState();
  const isElectron = typeof window !== 'undefined' && window.electronAPI;

  // Settings state
  const [settings, setSettings] = useState({
    // Recording settings
    recordingDirectory: '',
    includeMicrophone: true,
    includeSystemAudio: true,
    autoTranscribeRecordings: true,
    recordingQuality: 'medium',
    
    // Transcription settings
    defaultProvider: 'whisper-native',
    defaultModel: 'whisper-tiny',
    autoDetectLanguage: true,
    enableTimestamps: true,
    enableSpeakerDiarization: true,
    
    // Export settings
    defaultExportFormat: 'txt',
    includeTimestampsInExport: false,
    includeSpeakerLabels: true,
    exportDirectory: '',
    
    // UI settings
    theme: 'system',
    showWaveform: true,
    showTimeline: true,
    autoScroll: true,
    fontSize: 'medium',
    
    // Advanced settings
    enableTelemetry: false,
    enableAutoUpdates: true,
    logLevel: 'info'
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // Save all settings
      for (const [key, value] of Object.entries(settings)) {
        await window.electronAPI?.settings?.set?.(key, value);
      }
      
      // Update theme if changed
      if (settings.theme !== appState.theme) {
        updateTheme(settings.theme);
      }
      
      setHasChanges(false);
      toast.success('⚙️ Settings saved successfully');
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const selectDirectory = async (type) => {
    try {
      const result = await window.electronAPI.file.showOpenDialog({
        properties: ['openDirectory'],
        title: `Select ${type === 'recording' ? 'Recording' : 'Export'} Directory`
      });

      if (!result.canceled && result.filePaths?.length > 0) {
        const directory = result.filePaths[0];
        handleSettingChange(
          type === 'recording' ? 'recordingDirectory' : 'exportDirectory',
          directory
        );
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
      toast.error('Failed to select directory: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </CardTitle>
          <CardDescription>
            Configure your recording and transcription preferences
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Recording Settings */}
          <div className="space-y-4">
            <h3 className="font-medium">Recording Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="microphone-toggle">Include Microphone</Label>
                  <Switch
                    id="microphone-toggle"
                    checked={settings.includeMicrophone}
                    onCheckedChange={(checked) => handleSettingChange('includeMicrophone', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="system-audio-toggle">Include System Audio</Label>
                  <Switch
                    id="system-audio-toggle"
                    checked={settings.includeSystemAudio}
                    onCheckedChange={(checked) => handleSettingChange('includeSystemAudio', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-transcribe-toggle">Auto-transcribe after recording</Label>
                  <Switch
                    id="auto-transcribe-toggle"
                    checked={settings.autoTranscribeRecordings}
                    onCheckedChange={(checked) => handleSettingChange('autoTranscribeRecordings', checked)}
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="recording-quality">Recording Quality</Label>
                  <Select
                    value={settings.recordingQuality}
                    onValueChange={(value) => handleSettingChange('recordingQuality', value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select quality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Recording Directory</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectDirectory('recording')}
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Select
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Transcription Settings */}
          <div className="space-y-4">
            <h3 className="font-medium">Transcription Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-detect-toggle">Auto-detect Language</Label>
                  <Switch
                    id="auto-detect-toggle"
                    checked={settings.autoDetectLanguage}
                    onCheckedChange={(checked) => handleSettingChange('autoDetectLanguage', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="timestamps-toggle">Enable Timestamps</Label>
                  <Switch
                    id="timestamps-toggle"
                    checked={settings.enableTimestamps}
                    onCheckedChange={(checked) => handleSettingChange('enableTimestamps', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="speaker-toggle">Enable Speaker Diarization</Label>
                  <Switch
                    id="speaker-toggle"
                    checked={settings.enableSpeakerDiarization}
                    onCheckedChange={(checked) => handleSettingChange('enableSpeakerDiarization', checked)}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* UI Settings */}
          <div className="space-y-4">
            <h3 className="font-medium">UI Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="theme-select">Theme</Label>
                  <Select
                    value={settings.theme}
                    onValueChange={(value) => handleSettingChange('theme', value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="waveform-toggle">Show Waveform</Label>
                  <Switch
                    id="waveform-toggle"
                    checked={settings.showWaveform}
                    onCheckedChange={(checked) => handleSettingChange('showWaveform', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="timeline-toggle">Show Timeline</Label>
                  <Switch
                    id="timeline-toggle"
                    checked={settings.showTimeline}
                    onCheckedChange={(checked) => handleSettingChange('showTimeline', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="autoscroll-toggle">Auto-scroll</Label>
                  <Switch
                    id="autoscroll-toggle"
                    checked={settings.autoScroll}
                    onCheckedChange={(checked) => handleSettingChange('autoScroll', checked)}
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="font-size-select">Font Size</Label>
                  <Select
                    value={settings.fontSize}
                    onValueChange={(value) => handleSettingChange('fontSize', value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          
          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={saveSettings}
              disabled={!hasChanges || saving}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}