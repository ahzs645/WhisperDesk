// src/renderer/whisperdesk-ui/src/components/settings/utils/settingsHelpers.js

import { toast } from 'sonner';
import { RECORDING_SETTINGS_KEYS } from '../constants/categories';

export const selectDirectory = async (type) => {
  const isElectron = typeof window !== 'undefined' && window.electronAPI;
  if (!isElectron) return null;
  
  try {
    const result = await window.electronAPI.file.showOpenDialog({
      properties: ['openDirectory'],
      title: `Select ${type} directory`
    });
    if (result && !result.canceled && result.filePaths[0]) {
      const selectedPath = result.filePaths[0];
      toast.success(`${type} directory updated`);
      return selectedPath;
    }
    return null;
  } catch (error) {
    console.error(`❌ Failed to select ${type} directory:`, error);
    toast.error(`Failed to select ${type} directory`);
    return null;
  }
};

export const openDirectory = async (path, type) => {
  const isElectron = typeof window !== 'undefined' && window.electronAPI;
  if (!isElectron) return;
  
  try {
    if (path) {
      // Use showItemInFolder to reveal the directory
      await window.electronAPI.file.showItemInFolder(path);
    } else {
      toast.warning(`No ${type} directory set`);
    }
  } catch (error) {
    console.error(`❌ Failed to open ${type} directory:`, error);
    toast.error(`Failed to open ${type} directory`);
  }
};

export const isRecordingSetting = (key) => {
  return RECORDING_SETTINGS_KEYS.includes(key);
};

export const mapSettingKeyForRecorder = (key) => {
  return key === 'autoTranscribeRecordings' ? 'autoTranscribe' : key;
};

export const filterSettingsForBackend = (settings) => {
  // Filter out any UI-only settings that shouldn't be saved to backend
  const { ...backendSettings } = settings;
  return backendSettings;
};

export const validateSettingsChange = (key, value) => {
  // Add validation logic here if needed
  switch (key) {
    case 'maxSpeakers':
      return typeof value === 'number' && value >= 2 && value <= 20;
    case 'fontSize':
      return ['small', 'medium', 'large'].includes(value);
    case 'theme':
      return ['light', 'dark', 'system'].includes(value);
    case 'videoQuality':
    case 'audioQuality':
      return ['low', 'medium', 'high', 'ultra'].includes(value);
    default:
      return true;
  }
};