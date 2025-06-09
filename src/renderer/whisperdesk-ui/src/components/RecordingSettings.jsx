// src/renderer/whisperdesk-ui/src/components/RecordingSettings.jsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FolderOpen, Settings } from 'lucide-react';

export const RecordingSettings = ({ 
  recordingSettings,
  isRecording = false 
}) => {
  const {
    recordingSettings: settings,
    updateSetting,
    selectRecordingDirectory,
    saveRecordingSettings
  } = recordingSettings;

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Recording Settings</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="microphone-toggle">Include Microphone</Label>
            <Switch
              id="microphone-toggle"
              checked={settings.includeMicrophone}
              onCheckedChange={(checked) => updateSetting('includeMicrophone', checked)}
              disabled={isRecording}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="system-audio-toggle">Include System Audio</Label>
            <Switch
              id="system-audio-toggle"
              checked={settings.includeSystemAudio}
              onCheckedChange={(checked) => updateSetting('includeSystemAudio', checked)}
              disabled={isRecording}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-transcribe-toggle">Auto-transcribe after recording</Label>
            <Switch
              id="auto-transcribe-toggle"
              checked={settings.autoTranscribe}
              onCheckedChange={(checked) => updateSetting('autoTranscribe', checked)}
              disabled={isRecording}
            />
          </div>
        </div>
        
        <div className="space-y-3">
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
                {settings.recordingDirectory || 'Default location'}
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