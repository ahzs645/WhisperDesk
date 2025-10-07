// src/renderer/whisperdesk-ui/src/components/settings/components/AdvancedSettings.jsx

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingCard } from './SettingCard';
import { SettingRow } from './SettingRow';

export const AdvancedSettings = ({ settings, onSettingChange }) => {
  return (
    <div className="space-y-6">
      <SettingCard 
        title="System" 
        description="Advanced system and performance settings"
      >
        <div className="space-y-4">
          <SettingRow 
            label="Enable Auto-updates" 
            description="Automatically download and install updates"
          >
            <Switch
              checked={settings.enableAutoUpdates}
              onCheckedChange={(checked) => onSettingChange('enableAutoUpdates', checked)}
            />
          </SettingRow>

          <SettingRow label="Log Level" description="Amount of information to log">
            <Select
              value={settings.logLevel}
              onValueChange={(value) => onSettingChange('logLevel', value)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </div>
      </SettingCard>

      <SettingCard 
        title="Privacy" 
        description="Control data collection and usage"
      >
        <div className="space-y-4">
          <SettingRow 
            label="Enable Telemetry" 
            description="Help improve the app by sharing anonymous usage data"
            badge="Anonymous"
          >
            <Switch
              checked={settings.enableTelemetry}
              onCheckedChange={(checked) => onSettingChange('enableTelemetry', checked)}
            />
          </SettingRow>
        </div>
      </SettingCard>
    </div>
  );
};