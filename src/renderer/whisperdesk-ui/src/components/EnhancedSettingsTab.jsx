// src/renderer/whisperdesk-ui/src/components/EnhancedSettingsTab.jsx
import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FolderOpen, 
  Save, 
  RotateCcw, 
  Download, 
  Mic, 
  Monitor, 
  Palette,
  Settings as SettingsIcon,
  FileText,
  Volume2,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppState } from '@/App';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (!isElectron) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Load all settings from Electron
      const loadedSettings = await window.electronAPI.settings.getAll();
      
      // Merge with defaults
      const mergedSettings = {
        ...settings,
        ...loadedSettings,
        theme: appState.theme // Use theme from app state
      };
      
      setSettings(mergedSettings);
      setHasChanges(false);
      
      console.log('✅ Settings loaded:', mergedSettings);
      
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!isElectron) {
      toast.error('Settings can only be saved in Electron app');
      return;
    }

    try {
      setSaving(true);
      
      // Save each setting individually
      for (const [key, value] of Object.entries(settings)) {
        if (key === 'theme') {
          // Handle theme separately
          updateTheme(value);
        } else {
          await window.electronAPI.settings.set(key, value);
        }
      }
      
      setHasChanges(false);
      toast.success('⚙️ Settings saved successfully!');
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async () => {
    try {
      if (isElectron) {
        // Reset to defaults in Electron
        await window.electronAPI.settings.reset?.();
      }
      
      // Reset local state to defaults
      setSettings({
        recordingDirectory: '',
        includeMicrophone: true,
        includeSystemAudio: true,
        autoTranscribeRecordings: true,
        recordingQuality: 'medium',
        defaultProvider: 'whisper-native',
        defaultModel: 'whisper-tiny',
        autoDetectLanguage: true,
        enableTimestamps: true,
        enableSpeakerDiarization: true,
        defaultExportFormat: 'txt',
        includeTimestampsInExport: false,
        includeSpeakerLabels: true,
        exportDirectory: '',
        theme: 'system',
        showWaveform: true,
        showTimeline: true,
        autoScroll: true,
        fontSize: 'medium',
        enableTelemetry: false,
        enableAutoUpdates: true,
        logLevel: 'info'
      });
      
      setHasChanges(true);
      toast.success('🔄 Settings reset to defaults');
      
    } catch (error) {
      console.error('Failed to reset settings:', error);
      toast.error('Failed to reset settings: ' + error.message);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  };

  const selectDirectory = async (settingKey, title = 'Select Directory') => {
    if (!isElectron) {
      toast.error('Directory selection only available in Electron app');
      return;
    }

    try {
      const result = await window.electronAPI.file.showOpenDialog({
        properties: ['openDirectory'],
        title
      });

      if (!result.canceled && result.filePaths?.length > 0) {
        const directory = result.filePaths[0];
        updateSetting(settingKey, directory);
        toast.success(`📁 ${title} updated`);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
      toast.error('Failed to select directory: ' + error.message);
    }
  };

  const testToastStacking = () => {
    // Test different types of toasts
    toast.success('✅ Success toast 1');
    setTimeout(() => toast.error('❌ Error toast 2'), 100);
    setTimeout(() => toast.warning('⚠️ Warning toast 3'), 200);
    setTimeout(() => toast.info('ℹ️ Info toast 4'), 300);
    setTimeout(() => toast.loading('⏳ Loading toast 5'), 400);
  };

  const renderSystemInfo = () => (
    <div className="space-y-2">
      <h4 className="font-medium">System Information</h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex justify-between">
          <span>Platform:</span>
          <Badge variant="outline" className="text-xs">
            {isElectron ? 'Electron App' : 'Web Browser'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>Provider:</span>
          <Badge variant="outline" className="text-xs">
            {appState.selectedProvider || 'None'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>Model:</span>
          <Badge variant="outline" className="text-xs">
            {appState.selectedModel || 'None'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>Theme:</span>
          <Badge variant="outline" className="text-xs">
            {settings.theme}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>Recording:</span>
          <Badge variant={appState.isRecording ? "destructive" : "secondary"} className="text-xs">
            {appState.isRecording ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>Transcribing:</span>
          <Badge variant={appState.isTranscribing ? "default" : "secondary"} className="text-xs">
            {appState.isTranscribing ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Settings...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <SettingsIcon className="w-5 h-5" />
                <span>Settings</span>
              </CardTitle>
              <CardDescription>
                Configure your WhisperDesk preferences and options
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {hasChanges && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-200">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Unsaved changes
                </Badge>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={resetSettings}
                disabled={saving}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button 
                onClick={saveSettings} 
                disabled={!hasChanges || saving}
                size="sm"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recording Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mic className="w-5 h-5" />
              <span>Recording Settings</span>
            </CardTitle>
            <CardDescription>
              Configure screen recording and audio capture options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Recording Directory */}
            <div className="space-y-2">
              <Label>Recording Directory</Label>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => selectDirectory('recordingDirectory', 'Select Recording Directory')}
                  disabled={!isElectron}
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Choose
                </Button>
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {settings.recordingDirectory || 'Default location'}
                </span>
              </div>
            </div>

            {/* Audio Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="include-mic">Include Microphone</Label>
                <Switch
                  id="include-mic"
                  checked={settings.includeMicrophone}
                  onCheckedChange={(checked) => updateSetting('includeMicrophone', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="include-system">Include System Audio</Label>
                <Switch
                  id="include-system"
                  checked={settings.includeSystemAudio}
                  onCheckedChange={(checked) => updateSetting('includeSystemAudio', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-transcribe">Auto-transcribe Recordings</Label>
                <Switch
                  id="auto-transcribe"
                  checked={settings.autoTranscribeRecordings}
                  onCheckedChange={(checked) => updateSetting('autoTranscribeRecordings', checked)}
                />
              </div>
            </div>

            {/* Recording Quality */}
            <div className="space-y-2">
              <Label htmlFor="recording-quality">Recording Quality</Label>
              <Select
                value={settings.recordingQuality}
                onValueChange={(value) => updateSetting('recordingQuality', value)}
              >
                <SelectTrigger id="recording-quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (Faster, smaller files)</SelectItem>
                  <SelectItem value="medium">Medium (Balanced)</SelectItem>
                  <SelectItem value="high">High (Better quality, larger files)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
          </CardContent>
        </Card>

        {/* Export Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download className="w-5 h-5" />
              <span>Export Settings</span>
            </CardTitle>
            <CardDescription>
              Configure how transcriptions are exported and saved
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Export Directory */}
            <div className="space-y-2">
              <Label>Export Directory</Label>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => selectDirectory('exportDirectory', 'Select Export Directory')}
                  disabled={!isElectron}
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Choose
                </Button>
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {settings.exportDirectory || 'Default location'}
                </span>
              </div>
            </div>

            {/* Export Format */}
            <div className="space-y-2">
              <Label htmlFor="export-format">Default Export Format</Label>
              <Select
                value={settings.defaultExportFormat}
                onValueChange={(value) => updateSetting('defaultExportFormat', value)}
              >
                <SelectTrigger id="export-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="txt">Plain Text (.txt)</SelectItem>
                  <SelectItem value="md">Markdown (.md)</SelectItem>
                  <SelectItem value="json">JSON (.json)</SelectItem>
                  <SelectItem value="srt">Subtitle (.srt)</SelectItem>
                  <SelectItem value="vtt">WebVTT (.vtt)</SelectItem>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Export Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="export-timestamps">Include Timestamps</Label>
                <Switch
                  id="export-timestamps"
                  checked={settings.includeTimestampsInExport}
                  onCheckedChange={(checked) => updateSetting('includeTimestampsInExport', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="export-speakers">Include Speaker Labels</Label>
                <Switch
                  id="export-speakers"
                  checked={settings.includeSpeakerLabels}
                  onCheckedChange={(checked) => updateSetting('includeSpeakerLabels', checked)}
                />
              </div>
            </div>
            
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Palette className="w-5 h-5" />
              <span>Appearance</span>
            </CardTitle>
            <CardDescription>
              Customize the look and feel of WhisperDesk
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Theme */}
            <div className="space-y-2">
              <Label htmlFor="theme-select">Theme</Label>
              <Select
                value={settings.theme}
                onValueChange={(value) => updateSetting('theme', value)}
              >
                <SelectTrigger id="theme-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System (Auto)</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                Current: {settings.theme} | DOM: {document.documentElement.className || 'default'}
              </div>
            </div>

            {/* UI Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-waveform">Show Waveform</Label>
                <Switch
                  id="show-waveform"
                  checked={settings.showWaveform}
                  onCheckedChange={(checked) => updateSetting('showWaveform', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="show-timeline">Show Timeline</Label>
                <Switch
                  id="show-timeline"
                  checked={settings.showTimeline}
                  onCheckedChange={(checked) => updateSetting('showTimeline', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-scroll">Auto-scroll Transcripts</Label>
                <Switch
                  id="auto-scroll"
                  checked={settings.autoScroll}
                  onCheckedChange={(checked) => updateSetting('autoScroll', checked)}
                />
              </div>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <Label htmlFor="font-size">Font Size</Label>
              <Select
                value={settings.fontSize}
                onValueChange={(value) => updateSetting('fontSize', value)}
              >
                <SelectTrigger id="font-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="xl">Extra Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
          </CardContent>
        </Card>

        {/* Transcription Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Transcription Settings</span>
            </CardTitle>
            <CardDescription>
              Configure default transcription behavior and options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Default Provider */}
            <div className="space-y-2">
              <Label htmlFor="default-provider">Default Provider</Label>
              <Select
                value={settings.defaultProvider}
                onValueChange={(value) => updateSetting('defaultProvider', value)}
              >
                <SelectTrigger id="default-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whisper-native">Native Whisper</SelectItem>
                  <SelectItem value="deepgram">Deepgram Nova</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Default Model */}
            <div className="space-y-2">
              <Label htmlFor="default-model">Default Model</Label>
              <Select
                value={settings.defaultModel}
                onValueChange={(value) => updateSetting('defaultModel', value)}
              >
                <SelectTrigger id="default-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whisper-tiny">Tiny (Fastest)</SelectItem>
                  <SelectItem value="whisper-base">Base (Balanced)</SelectItem>
                  <SelectItem value="whisper-small">Small (Better accuracy)</SelectItem>
                  <SelectItem value="whisper-medium">Medium (High accuracy)</SelectItem>
                  <SelectItem value="whisper-large-v2">Large v2 (Best accuracy)</SelectItem>
                  <SelectItem value="whisper-large-v3">Large v3 (Latest)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transcription Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-detect-lang">Auto-detect Language</Label>
                <Switch
                  id="auto-detect-lang"
                  checked={settings.autoDetectLanguage}
                  onCheckedChange={(checked) => updateSetting('autoDetectLanguage', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="enable-timestamps">Enable Timestamps</Label>
                <Switch
                  id="enable-timestamps"
                  checked={settings.enableTimestamps}
                  onCheckedChange={(checked) => updateSetting('enableTimestamps', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="enable-diarization">Enable Speaker Diarization</Label>
                <Switch
                  id="enable-diarization"
                  checked={settings.enableSpeakerDiarization}
                  onCheckedChange={(checked) => updateSetting('enableSpeakerDiarization', checked)}
                />
              </div>
            </div>
            
          </CardContent>
        </Card>
      </div>

      {/* System Information & Debug */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Info className="w-5 h-5" />
            <span>System Information & Debug</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* System Info */}
            <div className="space-y-4">
              {renderSystemInfo()}
              
              {/* Toast Test */}
              <div className="space-y-2">
                <h4 className="font-medium">Toast Testing</h4>
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline" onClick={testToastStacking}>
                    Test Toast Stacking
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toast.dismiss()}>
                    Clear All Toasts
                  </Button>
                </div>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="space-y-4">
              <h4 className="font-medium">Advanced Options</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enable-telemetry">Enable Telemetry</Label>
                  <Switch
                    id="enable-telemetry"
                    checked={settings.enableTelemetry}
                    onCheckedChange={(checked) => updateSetting('enableTelemetry', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-updates">Enable Auto-updates</Label>
                  <Switch
                    id="auto-updates"
                    checked={settings.enableAutoUpdates}
                    onCheckedChange={(checked) => updateSetting('enableAutoUpdates', checked)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="log-level">Log Level</Label>
                <Select
                  value={settings.logLevel}
                  onValueChange={(value) => updateSetting('logLevel', value)}
                >
                  <SelectTrigger id="log-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warn">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}