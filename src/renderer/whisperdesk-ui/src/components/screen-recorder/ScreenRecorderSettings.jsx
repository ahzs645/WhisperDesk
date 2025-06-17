import React from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { FolderOpen, Settings } from 'lucide-react';
import { useScreenRecorderContext } from './ScreenRecorderProvider';

export const ScreenRecorderSettings = () => {
  const {
    recordingSettings,
    isRecording,
    updateSettings
  } = useScreenRecorderContext();

  const handleSettingChange = (key, value) => {
    updateSettings({ [key]: value });
  };

  const selectRecordingDirectory = async () => {
    if (window.electronAPI?.file?.showSaveDialog) {
      const result = await window.electronAPI.file.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Recording Directory'
      });

      if (!result.canceled && result.filePaths[0]) {
        handleSettingChange('recordingDirectory', result.filePaths[0]);
      }
    }
  };

  const saveRecordingSettings = async () => {
    if (window.electronAPI?.settings?.saveRecordingSettings) {
      try {
        await window.electronAPI.settings.saveRecordingSettings(recordingSettings);
        console.log('✅ Recording settings saved');
      } catch (error) {
        console.error('❌ Failed to save recording settings:', error);
      }
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Recording Settings</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="microphone-toggle">Include Microphone</Label>
            <Switch
              id="microphone-toggle"
              checked={recordingSettings.includeMicrophone}
              onCheckedChange={(checked) => handleSettingChange('includeMicrophone', checked)}
              disabled={isRecording}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="system-audio-toggle">Include System Audio</Label>
            <Switch
              id="system-audio-toggle"
              checked={recordingSettings.includeSystemAudio}
              onCheckedChange={(checked) => handleSettingChange('includeSystemAudio', checked)}
              disabled={isRecording}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-transcribe-toggle">Auto-transcribe after recording</Label>
            <Switch
              id="auto-transcribe-toggle"
              checked={recordingSettings.autoTranscribe}
              onCheckedChange={(checked) => handleSettingChange('autoTranscribe', checked)}
              disabled={isRecording}
            />
          </div>
        </div>
        
        <div className="space-y-3">
          <div>
            <Label>Video Quality</Label>
            <Select
              value={recordingSettings.videoQuality}
              onValueChange={(value) => handleSettingChange('videoQuality', value)}
              disabled={isRecording}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (720p)</SelectItem>
                <SelectItem value="medium">Medium (1080p)</SelectItem>
                <SelectItem value="high">High (1440p)</SelectItem>
                <SelectItem value="ultra">Ultra (4K)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Audio Quality</Label>
            <Select
              value={recordingSettings.audioQuality}
              onValueChange={(value) => handleSettingChange('audioQuality', value)}
              disabled={isRecording}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (64kbps)</SelectItem>
                <SelectItem value="medium">Medium (128kbps)</SelectItem>
                <SelectItem value="high">High (256kbps)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Recording Directory</Label>
            <div className="flex items-center space-x-2 mt-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={selectRecordingDirectory}
                disabled={isRecording}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Choose
              </Button>
              <span className="text-xs text-muted-foreground truncate">
                {recordingSettings.recordingDirectory || 'Default location'}
              </span>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={saveRecordingSettings}
            disabled={isRecording}
          >
            <Settings className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}; 