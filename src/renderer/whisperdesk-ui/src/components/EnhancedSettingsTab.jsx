// src/renderer/whisperdesk-ui/src/components/EnhancedSettingsTab.jsx
import React, { useState, useEffect } from 'react';
import { useAppState } from '@/App';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderOpen, Settings, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useScreenRecorderContext } from './screen-recorder/ScreenRecorderProvider';

export function EnhancedSettingsTab() {
  const { appState, updateTheme } = useAppState();
  const isElectron = typeof window !== 'undefined' && window.electronAPI;
  
  // Get screen recorder context for two-way sync
  const screenRecorderContext = useScreenRecorderContext();

  // Settings state
  const [settings, setSettings] = useState({
    // Recording settings
    recordingDirectory: '',
    includeMicrophone: true,
    includeSystemAudio: true,
    autoTranscribeRecordings: true,
    recordingQuality: 'medium',
    videoQuality: 'medium',
    audioQuality: 'medium',
    
    // Transcription settings
    defaultProvider: 'whisper-native',
    defaultModel: 'whisper-tiny',
    autoDetectLanguage: true,
    enableTimestamps: true,
    enableSpeakerDiarization: true,
    maxSpeakers: 10,
    
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
  const [loading, setLoading] = useState(true);

  // Load settings from backend on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Sync with screen recorder settings
  useEffect(() => {
    if (screenRecorderContext && !loading) {
      const { recordingSettings } = screenRecorderContext;
      setSettings(prev => ({
        ...prev,
        includeMicrophone: recordingSettings.includeMicrophone,
        includeSystemAudio: recordingSettings.includeSystemAudio,
        videoQuality: recordingSettings.videoQuality,
        audioQuality: recordingSettings.audioQuality,
        recordingDirectory: recordingSettings.recordingDirectory || prev.recordingDirectory,
        autoTranscribeRecordings: recordingSettings.autoTranscribe
      }));
    }
  }, [screenRecorderContext?.recordingSettings, loading]);

  const loadSettings = async () => {
    if (!isElectron) return;
    
    try {
      setLoading(true);
      
      // Load all settings from backend
      const allSettings = await window.electronAPI.settings.getAll();
      
      // Get default recording directory if not set
      let recordingDir = allSettings.recordingDirectory;
      if (!recordingDir) {
        recordingDir = await window.electronAPI.file.getDefaultRecordingsDirectory();
      }
      
      setSettings(prev => ({
        ...prev,
        ...allSettings,
        recordingDirectory: recordingDir,
        // Map some backend settings to frontend names
        videoQuality: allSettings.videoQuality || allSettings.recordingQuality || prev.videoQuality,
        includeMicrophone: allSettings.includeMicrophone ?? prev.includeMicrophone,
        includeSystemAudio: allSettings.includeSystemAudio ?? prev.includeSystemAudio
      }));
      
      console.log('✅ Settings loaded from backend:', allSettings);
      
    } catch (error) {
      console.error('❌ Failed to load settings:', error);
      toast.error('Failed to load settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
    
    // If this is a recording setting, also update screen recorder context
    if (['includeMicrophone', 'includeSystemAudio', 'videoQuality', 'audioQuality', 'recordingDirectory', 'autoTranscribeRecordings'].includes(key)) {
      const recordingSettingKey = key === 'autoTranscribeRecordings' ? 'autoTranscribe' : key;
      screenRecorderContext?.updateSettings?.({ [recordingSettingKey]: value });
    }
  };

  const saveSettings = async () => {
    if (!isElectron) return;
    
    try {
      setSaving(true);
      
      // Save all settings to backend
      for (const [key, value] of Object.entries(settings)) {
        await window.electronAPI?.settings?.set?.(key, value);
      }
      
      // Update theme if changed
      if (settings.theme !== appState.theme) {
        updateTheme(settings.theme);
      }
      
      // Sync recording settings with screen recorder
      if (screenRecorderContext?.updateSettings) {
        screenRecorderContext.updateSettings({
          includeMicrophone: settings.includeMicrophone,
          includeSystemAudio: settings.includeSystemAudio,
          videoQuality: settings.videoQuality,
          audioQuality: settings.audioQuality,
          recordingDirectory: settings.recordingDirectory,
          autoTranscribe: settings.autoTranscribeRecordings
        });
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

  const resetSettings = async () => {
    try {
      await loadSettings();
      setHasChanges(false);
      toast.success('Settings reset to saved values');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      toast.error('Failed to reset settings');
    }
  };

  const selectDirectory = async (type) => {
    if (!isElectron) return;
    
    try {
      const result = await window.electronAPI.file.showOpenDialog({
        properties: ['openDirectory'],
        title: `Select ${type === 'recording' ? 'Recording' : 'Export'} Directory`
      });

      if (!result.canceled && result.filePaths?.length > 0) {
        const directory = result.filePaths[0];
        const settingKey = type === 'recording' ? 'recordingDirectory' : 'exportDirectory';
        handleSettingChange(settingKey, directory);
        
        toast.success(`${type === 'recording' ? 'Recording' : 'Export'} directory updated`);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
      toast.error('Failed to select directory: ' + error.message);
    }
  };

  const openDirectory = async (type) => {
    if (!isElectron) return;
    
    const directory = type === 'recording' ? settings.recordingDirectory : settings.exportDirectory;
    if (!directory) {
      toast.error('No directory set');
      return;
    }
    
    try {
      // Open directory in file manager
      await window.electronAPI.file.showItemInFolder(directory);
    } catch (error) {
      console.error('Failed to open directory:', error);
      toast.error('Failed to open directory');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading settings...</span>
      </div>
    );
  }

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
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="video-quality">Video Quality</Label>
                    <Select
                      value={settings.videoQuality}
                      onValueChange={(value) => handleSettingChange('videoQuality', value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select quality" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low (720p)</SelectItem>
                        <SelectItem value="medium">Medium (1080p)</SelectItem>
                        <SelectItem value="high">High (1440p)</SelectItem>
                        <SelectItem value="ultra">Ultra (4K)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="audio-quality">Audio Quality</Label>
                    <Select
                      value={settings.audioQuality}
                      onValueChange={(value) => handleSettingChange('audioQuality', value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select quality" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low (64kbps)</SelectItem>
                        <SelectItem value="medium">Medium (128kbps)</SelectItem>
                        <SelectItem value="high">High (256kbps)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                
                  <div className="space-y-2">
                    <Label>Recording Directory</Label>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectDirectory('recording')}
                      >
                        <FolderOpen className="w-4 h-4 mr-2" />
                        Select
                      </Button>
                      {settings.recordingDirectory && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDirectory('recording')}
                          title="Open in file manager"
                        >
                          📁
                        </Button>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground break-all">
                      {settings.recordingDirectory || 'Using default location'}
                    </div>
                  </div>
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
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="default-provider">Default Provider</Label>
                  <Select
                    value={settings.defaultProvider}
                    onValueChange={(value) => handleSettingChange('defaultProvider', value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whisper-native">Whisper (Native)</SelectItem>
                      <SelectItem value="deepgram">Deepgram</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="default-model">Default Model</Label>
                  <Select
                    value={settings.defaultModel}
                    onValueChange={(value) => handleSettingChange('defaultModel', value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whisper-tiny">Tiny</SelectItem>
                      <SelectItem value="whisper-base">Base</SelectItem>
                      <SelectItem value="whisper-small">Small</SelectItem>
                      <SelectItem value="whisper-medium">Medium</SelectItem>
                      <SelectItem value="whisper-large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settings.enableSpeakerDiarization && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="max-speakers">Max Speakers</Label>
                    <Select
                      value={settings.maxSpeakers?.toString()}
                      onValueChange={(value) => handleSettingChange('maxSpeakers', parseInt(value))}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select max speakers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="6">6</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Export Settings */}
          <div className="space-y-4">
            <h3 className="font-medium">Export Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="export-format">Default Export Format</Label>
                  <Select
                    value={settings.defaultExportFormat}
                    onValueChange={(value) => handleSettingChange('defaultExportFormat', value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="txt">Plain Text (.txt)</SelectItem>
                      <SelectItem value="srt">Subtitle (.srt)</SelectItem>
                      <SelectItem value="vtt">WebVTT (.vtt)</SelectItem>
                      <SelectItem value="json">JSON (.json)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="timestamps-export-toggle">Include Timestamps in Export</Label>
                  <Switch
                    id="timestamps-export-toggle"
                    checked={settings.includeTimestampsInExport}
                    onCheckedChange={(checked) => handleSettingChange('includeTimestampsInExport', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="speaker-labels-toggle">Include Speaker Labels</Label>
                  <Switch
                    id="speaker-labels-toggle"
                    checked={settings.includeSpeakerLabels}
                    onCheckedChange={(checked) => handleSettingChange('includeSpeakerLabels', checked)}
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Export Directory</Label>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectDirectory('export')}
                    >
                      <FolderOpen className="w-4 h-4 mr-2" />
                      Select
                    </Button>
                    {settings.exportDirectory && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDirectory('export')}
                        title="Open in file manager"
                      >
                        📁
                      </Button>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground break-all">
                    {settings.exportDirectory || 'Using default location'}
                  </div>
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
          
          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={resetSettings}
                disabled={!hasChanges || saving}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
            
            <div className="flex space-x-2">
              {hasChanges && (
                <span className="text-sm text-muted-foreground self-center">
                  You have unsaved changes
                </span>
              )}
              <Button
                onClick={saveSettings}
                disabled={!hasChanges || saving}
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}