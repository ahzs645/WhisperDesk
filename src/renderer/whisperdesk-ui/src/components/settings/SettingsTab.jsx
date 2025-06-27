// src/renderer/whisperdesk-ui/src/components/settings/SettingsTab.jsx

import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useScreenRecorderContext } from '../screen-recorder/ScreenRecorderProvider';
import { useSettings } from './hooks/useSettings';
import { SettingsLayout } from './components/SettingsLayout';
import { RecordingSettings } from './components/RecordingSettings';
import { TranscriptionSettings } from './components/TranscriptionSettings';
import { ExportSettings } from './components/ExportSettings';
import { InterfaceSettings } from './components/InterfaceSettings';
import { AdvancedSettings } from './components/AdvancedSettings';

export const SettingsTab = () => {
  const [activeCategory, setActiveCategory] = useState('recording');
  const screenRecorderContext = useScreenRecorderContext();
  
  const {
    settings,
    hasChanges,
    saving,
    loading,
    handleSettingChange,
    saveSettings,
    resetSettings,
    handleDirectorySelect,
    handleDirectoryOpen
  } = useSettings(screenRecorderContext);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'recording':
        return (
          <RecordingSettings 
            settings={settings}
            onSettingChange={handleSettingChange}
            onDirectorySelect={handleDirectorySelect}
            onDirectoryOpen={handleDirectoryOpen}
          />
        );

      case 'transcription':
        return (
          <TranscriptionSettings 
            settings={settings}
            onSettingChange={handleSettingChange}
          />
        );

      case 'export':
        return (
          <ExportSettings 
            settings={settings}
            onSettingChange={handleSettingChange}
            onDirectorySelect={handleDirectorySelect}
            onDirectoryOpen={handleDirectoryOpen}
          />
        );

      case 'interface':
        return (
          <InterfaceSettings 
            settings={settings}
            onSettingChange={handleSettingChange}
          />
        );

      case 'advanced':
        return (
          <AdvancedSettings 
            settings={settings}
            onSettingChange={handleSettingChange}
          />
        );

      default:
        return null;
    }
  };

  return (
    <SettingsLayout
      activeCategory={activeCategory}
      onCategoryChange={setActiveCategory}
      hasChanges={hasChanges}
      saving={saving}
      onSave={saveSettings}
      onReset={resetSettings}
    >
      {renderCategoryContent()}
    </SettingsLayout>
  );
};