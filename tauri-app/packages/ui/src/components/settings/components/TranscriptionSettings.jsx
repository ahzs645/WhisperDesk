// src/renderer/whisperdesk-ui/src/components/settings/components/TranscriptionSettings.jsx

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingCard } from './SettingCard';
import { SettingRow } from './SettingRow';

export const TranscriptionSettings = ({ settings, onSettingChange }) => {
  return (
    <div className="space-y-6">
      <SettingCard 
        title="AI Provider & Model" 
        description="Configure the transcription engine and model"
      >
        <div className="space-y-4">
          <SettingRow label="Provider" description="AI service for transcription">
            <Select
              value={settings.defaultProvider}
              onValueChange={(value) => onSettingChange('defaultProvider', value)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whisper-native">Whisper Native</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow label="Model" description="Balance between speed and accuracy">
            <Select
              value={settings.defaultModel}
              onValueChange={(value) => onSettingChange('defaultModel', value)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whisper-tiny">Tiny (Fast)</SelectItem>
                <SelectItem value="whisper-base">Base</SelectItem>
                <SelectItem value="whisper-small">Small</SelectItem>
                <SelectItem value="whisper-medium">Medium</SelectItem>
                <SelectItem value="whisper-large">Large (Slow)</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </SettingCard>

      <SettingCard 
        title="Language & Detection" 
        description="Configure language settings and detection"
      >
        <div className="space-y-4">
          <SettingRow 
            label="Auto-detect Language" 
            description="Automatically identify the spoken language"
            badge="AI"
          >
            <Switch
              checked={settings.autoDetectLanguage}
              onCheckedChange={(checked) => onSettingChange('autoDetectLanguage', checked)}
            />
          </SettingRow>

          <SettingRow 
            label="Enable Timestamps" 
            description="Include timing information in transcripts"
          >
            <Switch
              checked={settings.enableTimestamps}
              onCheckedChange={(checked) => onSettingChange('enableTimestamps', checked)}
            />
          </SettingRow>
        </div>
      </SettingCard>

      <SettingCard 
        title="Speaker Detection" 
        description="Identify and separate different speakers"
        badge="Premium"
      >
        <div className="space-y-4">
          <SettingRow 
            label="Enable Speaker Diarization" 
            description="Automatically identify different speakers"
            badge="AI"
          >
            <Switch
              checked={settings.enableSpeakerDiarization}
              onCheckedChange={(checked) => onSettingChange('enableSpeakerDiarization', checked)}
            />
          </SettingRow>

          {settings.enableSpeakerDiarization && (
            <SettingRow 
              label="Maximum Speakers" 
              description="Limit the number of speakers to detect"
            >
              <Select
                value={settings.maxSpeakers.toString()}
                onValueChange={(value) => onSettingChange('maxSpeakers', parseInt(value))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 8, 10, 15, 20].map(num => (
                    <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
          )}
        </div>
      </SettingCard>
    </div>
  );
};