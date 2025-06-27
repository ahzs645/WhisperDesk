// src/renderer/whisperdesk-ui/src/components/settings/components/ExportSettings.jsx

import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderOpen, Upload } from 'lucide-react';
import { SettingCard } from './SettingCard';
import { SettingRow } from './SettingRow';

export const ExportSettings = ({ 
  settings, 
  onSettingChange, 
  onDirectorySelect, 
  onDirectoryOpen 
}) => {
  return (
    <div className="space-y-6">
      <SettingCard 
        title="Export Formats" 
        description="Choose default format and content options"
      >
        <div className="space-y-4">
          <SettingRow label="Default Format" description="Primary export format for transcripts">
            <Select
              value={settings.defaultExportFormat}
              onValueChange={(value) => onSettingChange('defaultExportFormat', value)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="txt">Text (.txt)</SelectItem>
                <SelectItem value="json">JSON (.json)</SelectItem>
                <SelectItem value="srt">Subtitles (.srt)</SelectItem>
                <SelectItem value="vtt">WebVTT (.vtt)</SelectItem>
                <SelectItem value="csv">CSV (.csv)</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow 
            label="Include Timestamps" 
            description="Add timing information to exports"
          >
            <Switch
              checked={settings.includeTimestampsInExport}
              onCheckedChange={(checked) => onSettingChange('includeTimestampsInExport', checked)}
            />
          </SettingRow>

          <SettingRow 
            label="Include Speaker Labels" 
            description="Add speaker identification to exports"
          >
            <Switch
              checked={settings.includeSpeakerLabels}
              onCheckedChange={(checked) => onSettingChange('includeSpeakerLabels', checked)}
            />
          </SettingRow>
        </div>
      </SettingCard>

      <SettingCard 
        title="Export Destination" 
        description="Where exported files are saved"
      >
        <div className="space-y-4">
          <SettingRow 
            label="Export Directory" 
            description="Default location for exported transcripts"
          >
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onDirectorySelect('export')}>
                <FolderOpen className="w-4 h-4 mr-2" />
                Browse
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDirectoryOpen('export')}>
                <Upload className="w-4 h-4" />
              </Button>
            </div>
          </SettingRow>

          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
            {settings.exportDirectory || 'Using default location'}
          </div>
        </div>
      </SettingCard>
    </div>
  );
};

// src/renderer/whisperdesk-ui/src/components/settings/components/InterfaceSettings.jsx

export const InterfaceSettings = ({ settings, onSettingChange }) => {
  return (
    <div className="space-y-6">
      <SettingCard 
        title="Appearance" 
        description="Customize the look and feel of the application"
      >
        <div className="space-y-4">
          <SettingRow label="Theme" description="Choose your preferred color scheme">
            <Select
              value={settings.theme}
              onValueChange={(value) => onSettingChange('theme', value)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="Font Size" description="Adjust text size throughout the app">
            <Select
              value={settings.fontSize}
              onValueChange={(value) => onSettingChange('fontSize', value)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </SettingCard>

      <SettingCard 
        title="Display Options" 
        description="Control what elements are shown in the interface"
      >
        <div className="space-y-4">
          <SettingRow 
            label="Show Waveform" 
            description="Display audio waveform during playback"
          >
            <Switch
              checked={settings.showWaveform}
              onCheckedChange={(checked) => onSettingChange('showWaveform', checked)}
            />
          </SettingRow>

          <SettingRow 
            label="Show Timeline" 
            description="Display timeline scrubber for navigation"
          >
            <Switch
              checked={settings.showTimeline}
              onCheckedChange={(checked) => onSettingChange('showTimeline', checked)}
            />
          </SettingRow>

          <SettingRow 
            label="Auto-scroll" 
            description="Automatically scroll to follow playback"
          >
            <Switch
              checked={settings.autoScroll}
              onCheckedChange={(checked) => onSettingChange('autoScroll', checked)}
            />
          </SettingRow>
        </div>
      </SettingCard>
    </div>
  );
};