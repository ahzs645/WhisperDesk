// src/renderer/whisperdesk-ui/src/components/settings/hooks/useSettings.js

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAppState } from '@/App';
import { DEFAULT_SETTINGS } from '../utils/defaultSettings';
import { 
  selectDirectory, 
  openDirectory, 
  isRecordingSetting, 
  mapSettingKeyForRecorder,
  filterSettingsForBackend,
  validateSettingsChange
} from '../utils/settingsHelpers';

export const useSettings = (screenRecorderContext) => {
  const { updateTheme } = useAppState();
  const isElectron = typeof window !== 'undefined' && window.electronAPI;
  
  // State management
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load settings from backend on mount
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
    if (!isElectron) {
      setLoading(false);
      return;
    }
    
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
    // Validate the change
    if (!validateSettingsChange(key, value)) {
      toast.error(`Invalid value for ${key}`);
      return;
    }

    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
    
    // Handle theme changes immediately
    if (key === 'theme') {
      updateTheme(value);
    }
    
    // If this is a recording setting, also update screen recorder context
    if (isRecordingSetting(key)) {
      const recordingSettingKey = mapSettingKeyForRecorder(key);
      screenRecorderContext?.updateSettings?.({ [recordingSettingKey]: value });
    }
  };

  const saveSettings = async () => {
    if (!isElectron) return;
    
    try {
      setSaving(true);
      
      // Filter and save all settings to backend
      const backendSettings = filterSettingsForBackend(settings);
      for (const [key, value] of Object.entries(backendSettings)) {
        await window.electronAPI?.settings?.set?.(key, value);
      }
      
      // Apply theme change immediately
      updateTheme(settings.theme);
      
      console.log('✅ Settings saved successfully');
      toast.success('Settings saved successfully');
      setHasChanges(false);
      
    } catch (error) {
      console.error('❌ Failed to save settings:', error);
      toast.error('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async () => {
    if (!isElectron) return;
    
    try {
      // Reset to defaults - reload from backend
      await loadSettings();
      setHasChanges(false);
      toast.success('Settings reset to defaults');
    } catch (error) {
      console.error('❌ Failed to reset settings:', error);
      toast.error('Failed to reset settings');
    }
  };

  const handleDirectorySelect = async (type) => {
    const selectedPath = await selectDirectory(type);
    if (selectedPath) {
      const settingKey = type === 'recording' ? 'recordingDirectory' : 'exportDirectory';
      handleSettingChange(settingKey, selectedPath);
    }
  };

  const handleDirectoryOpen = async (type) => {
    const path = type === 'recording' ? settings.recordingDirectory : settings.exportDirectory;
    await openDirectory(path, type);
  };

  return {
    settings,
    hasChanges,
    saving,
    loading,
    handleSettingChange,
    saveSettings,
    resetSettings,
    handleDirectorySelect,
    handleDirectoryOpen
  };
};