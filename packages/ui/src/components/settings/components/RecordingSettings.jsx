// src/renderer/whisperdesk-ui/src/components/settings/components/RecordingSettings.jsx

import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderOpen, Monitor } from 'lucide-react';
import { SettingCard } from './SettingCard';
import { SettingRow } from './SettingRow';

export const RecordingSettings = ({ 
  settings, 
  onSettingChange, 
  onDirectorySelect, 
  onDirectoryOpen 
}) => {
  return (
    <div className="space-y-6">
      <SettingCard 
        title="Recording Quality" 
        description="Configure video and audio capture settings"
      >
        <div className="space-y-4">
          <SettingRow label="Video Quality" description="Higher quality means larger file sizes">
            <Select
              value={settings.videoQuality}
              onValueChange={(value) => onSettingChange('videoQuality', value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="ultra">Ultra</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="Audio Quality" description="Audio bitrate and sample rate">
            <Select
              value={settings.audioQuality}
              onValueChange={(value) => onSettingChange('audioQuality', value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (64kbps)</SelectItem>
                <SelectItem value="medium">Medium (128kbps)</SelectItem>
                <SelectItem value="high">High (256kbps)</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </SettingCard>

      <SettingCard 
        title="Audio Sources" 
        description="Choose which audio to capture during recording"
      >
        <div className="space-y-4">
          <SettingRow 
            label="Include Microphone" 
            description="Record audio from your microphone"
          >
            <Switch
              checked={settings.includeMicrophone}
              onCheckedChange={(checked) => onSettingChange('includeMicrophone', checked)}
            />
          </SettingRow>

          <SettingRow 
            label="Include System Audio" 
            description="Record audio from your computer"
            badge={!settings.includeSystemAudio ? "Silent" : ""}
          >
            <Switch
              checked={settings.includeSystemAudio}
              onCheckedChange={(checked) => onSettingChange('includeSystemAudio', checked)}
            />
          </SettingRow>
        </div>
      </SettingCard>

      <SettingCard 
        title="Storage & Processing" 
        description="Where recordings are saved and how they're processed"
      >
        <div className="space-y-4">
          <SettingRow 
            label="Recording Directory" 
            description="Choose where your recordings are saved"
          >
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onDirectorySelect('recording')}>
                <FolderOpen className="w-4 h-4 mr-2" />
                Browse
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDirectoryOpen('recording')}>
                <Monitor className="w-4 h-4" />
              </Button>
            </div>
          </SettingRow>

          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
            {settings.recordingDirectory || 'Using default location'}
          </div>

          <SettingRow 
            label="Auto-transcribe Recordings" 
            description="Automatically transcribe recordings when they finish"
            badge="AI"
          >
            <Switch
              checked={settings.autoTranscribeRecordings}
              onCheckedChange={(checked) => onSettingChange('autoTranscribeRecordings', checked)}
            />
          </SettingRow>
        </div>
      </SettingCard>
    </div>
  );
};