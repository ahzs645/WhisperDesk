// src/renderer/whisperdesk-ui/src/components/settings/components/InterfaceSettings.jsx

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingCard } from './SettingCard';
import { SettingRow } from './SettingRow';

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
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow 
            label="Compact Mode" 
            description="Use a more condensed interface layout"
          >
            <Switch
              checked={settings.compactMode}
              onCheckedChange={(checked) => onSettingChange('compactMode', checked)}
            />
          </SettingRow>

          <SettingRow 
            label="Show File Indicators" 
            description="Display status indicators in tab headers"
          >
            <Switch
              checked={settings.showFileIndicators}
              onCheckedChange={(checked) => onSettingChange('showFileIndicators', checked)}
            />
          </SettingRow>
        </div>
      </SettingCard>

      <SettingCard 
        title="Notifications" 
        description="Configure when and how you receive notifications"
      >
        <div className="space-y-4">
          <SettingRow 
            label="Show Success Notifications" 
            description="Display notifications when transcriptions complete"
          >
            <Switch
              checked={settings.showSuccessNotifications}
              onCheckedChange={(checked) => onSettingChange('showSuccessNotifications', checked)}
            />
          </SettingRow>

          <SettingRow 
            label="Show Error Notifications" 
            description="Display notifications when errors occur"
          >
            <Switch
              checked={settings.showErrorNotifications}
              onCheckedChange={(checked) => onSettingChange('showErrorNotifications', checked)}
            />
          </SettingRow>

          <SettingRow 
            label="Auto-dismiss Notifications" 
            description="Automatically hide notifications after a few seconds"
          >
            <Switch
              checked={settings.autoDismissNotifications}
              onCheckedChange={(checked) => onSettingChange('autoDismissNotifications', checked)}
            />
          </SettingRow>
        </div>
      </SettingCard>

      <SettingCard 
        title="Performance" 
        description="Optimize performance and resource usage"
      >
        <div className="space-y-4">
          <SettingRow 
            label="Hardware Acceleration" 
            description="Use GPU acceleration when available"
          >
            <Switch
              checked={settings.hardwareAcceleration}
              onCheckedChange={(checked) => onSettingChange('hardwareAcceleration', checked)}
            />
          </SettingRow>

          <SettingRow 
            label="Reduce Animations" 
            description="Minimize animations for better performance"
          >
            <Switch
              checked={settings.reduceAnimations}
              onCheckedChange={(checked) => onSettingChange('reduceAnimations', checked)}
            />
          </SettingRow>
        </div>
      </SettingCard>
    </div>
  );
};
