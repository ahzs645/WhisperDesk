// src/renderer/whisperdesk-ui/src/hooks/useRecordingSettings.js
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useAppState } from '@/App';

export const useRecordingSettings = () => {
  const { updateAppState } = useAppState();
  
  const [recordingSettings, setRecordingSettings] = useState({
    includeMicrophone: true,
    includeSystemAudio: true,
    autoTranscribe: true,
    recordingDirectory: ''
  });

  const loadRecordingSettings = useCallback(async () => {
    try {
      const directory = await window.electronAPI?.settings?.get?.('recordingDirectory');
      const micPref = await window.electronAPI?.settings?.get?.('includeMicrophone');
      const systemPref = await window.electronAPI?.settings?.get?.('includeSystemAudio');
      const autoTranscribePref = await window.electronAPI?.settings?.get?.('autoTranscribeRecordings');
      
      setRecordingSettings(prev => ({
        ...prev,
        recordingDirectory: directory || '',
        includeMicrophone: micPref !== undefined ? micPref : true,
        includeSystemAudio: systemPref !== undefined ? systemPref : true,
        autoTranscribe: autoTranscribePref !== undefined ? autoTranscribePref : true
      }));
      
    } catch (error) {
      console.warn('Could not load recording settings:', error);
    }
  }, []);

  const updateSetting = useCallback((key, value) => {
    setRecordingSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const selectRecordingDirectory = useCallback(async () => {
    try {
      const result = await window.electronAPI.file.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Recording Directory'
      });

      if (!result.canceled && result.filePaths?.length > 0) {
        const directory = result.filePaths[0];
        updateSetting('recordingDirectory', directory);
        
        await window.electronAPI?.settings?.set?.('recordingDirectory', directory);
        toast.success('📁 Recording directory updated');
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
      toast.error('Failed to select directory: ' + error.message);
    }
  }, [updateSetting]);

  const saveRecordingSettings = useCallback(async () => {
    try {
      await window.electronAPI?.settings?.set?.('includeMicrophone', recordingSettings.includeMicrophone);
      await window.electronAPI?.settings?.set?.('includeSystemAudio', recordingSettings.includeSystemAudio);
      await window.electronAPI?.settings?.set?.('autoTranscribeRecordings', recordingSettings.autoTranscribe);
      
      updateAppState({
        recordingSettings: recordingSettings
      });
      
      toast.success('⚙️ Recording settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings: ' + error.message);
    }
  }, [recordingSettings, updateAppState]);

  const triggerAutoTranscription = useCallback(async (fileInfo) => {
    try {
      console.log('🤖 Auto-triggering transcription for:', fileInfo.name);
      
      updateAppState({ selectedFile: fileInfo });
      
      const event = new CustomEvent('autoTranscribe', { 
        detail: { file: fileInfo } 
      });
      window.dispatchEvent(event);
      
      toast.info('🤖 Auto-transcription started...');
      
    } catch (error) {
      console.error('Auto-transcription failed:', error);
      toast.error('Auto-transcription failed: ' + error.message);
    }
  }, [updateAppState]);

  return {
    recordingSettings,
    updateSetting,
    loadRecordingSettings,
    selectRecordingDirectory,
    saveRecordingSettings,
    triggerAutoTranscription
  };
};