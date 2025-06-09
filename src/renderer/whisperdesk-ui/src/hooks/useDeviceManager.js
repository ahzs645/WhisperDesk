// src/renderer/whisperdesk-ui/src/hooks/useDeviceManager.js - FIXED
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { appInitializer } from '../utils/AppInitializer';

export const useDeviceManager = () => {
  // 🔴 FIXED: Get state from centralized source instead of managing locally
  const [localState, setLocalState] = useState({
    availableDevices: { screens: [], audio: [] },
    selectedScreen: '',
    selectedAudioInput: '',
    loadingDevices: false,
    devicesInitialized: false
  });

  // 🔴 FIXED: Sync with central state on mount and when central state changes
  useEffect(() => {
    const updateFromCentral = () => {
      const centralState = appInitializer.getCentralState();
      setLocalState({
        availableDevices: centralState.availableDevices || { screens: [], audio: [] },
        selectedScreen: centralState.selectedScreen || '',
        selectedAudioInput: centralState.selectedAudioInput || '',
        loadingDevices: centralState.loadingDevices || false,
        devicesInitialized: centralState.devicesInitialized || false
      });
    };

    // Initial sync
    updateFromCentral();

    // Set up listener for central state changes (if AppInitializer has such mechanism)
    // For now, we'll poll periodically or rely on React re-renders
    const interval = setInterval(updateFromCentral, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // 🔴 FIXED: Use centralized device management methods
  const refreshDevices = useCallback(async () => {
    try {
      const deviceManager = appInitializer.getService('deviceManager');
      if (deviceManager?.refreshDevices) {
        await deviceManager.refreshDevices();
        toast.success('🔄 Devices refreshed successfully');
      } else {
        throw new Error('Device manager service not available');
      }
    } catch (error) {
      console.error('Failed to refresh devices:', error);
      toast.error('Failed to refresh devices: ' + error.message);
    }
  }, []);

  const setSelectedScreen = useCallback((screenId) => {
    const deviceManager = appInitializer.getService('deviceManager');
    if (deviceManager?.updateDeviceSelections) {
      deviceManager.updateDeviceSelections(screenId, localState.selectedAudioInput);
    }
  }, [localState.selectedAudioInput]);

  const setSelectedAudioInput = useCallback((audioId) => {
    const deviceManager = appInitializer.getService('deviceManager');
    if (deviceManager?.updateDeviceSelections) {
      deviceManager.updateDeviceSelections(localState.selectedScreen, audioId);
    }
  }, [localState.selectedScreen]);

  const validateAndFixDeviceSelections = useCallback(async () => {
    try {
      const deviceManager = appInitializer.getService('deviceManager');
      if (deviceManager?.validateDevices) {
        return await deviceManager.validateDevices();
      }
      return { valid: true, changed: false, issues: [] };
    } catch (error) {
      console.error('❌ Failed to validate devices:', error);
      return { valid: false, changed: false, issues: [error.message] };
    }
  }, []);

  return {
    // State from centralized source
    availableDevices: localState.availableDevices,
    selectedScreen: localState.selectedScreen,
    selectedAudioInput: localState.selectedAudioInput,
    loadingDevices: localState.loadingDevices,
    devicesInitialized: localState.devicesInitialized,
    
    // Actions that use centralized methods
    setSelectedScreen,
    setSelectedAudioInput,
    refreshDevices,
    validateAndFixDeviceSelections,
    
    // Utility methods (kept for compatibility)
    updateDevices: () => console.warn('updateDevices is deprecated - use centralized device manager'),
    shouldUpdateDevices: () => false,
    cleanup: () => {}, // No cleanup needed since we don't manage state
    setLoadingDevices: () => console.warn('setLoadingDevices is deprecated - managed centrally')
  };
};

// src/renderer/whisperdesk-ui/src/hooks/useScreenRecorder.js - FIXED
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAppState } from '@/App';
import { formatDuration, getErrorMessage } from '../utils/recordingUtils';
import { appInitializer } from '../utils/AppInitializer';

export const useScreenRecorder = ({ deviceManager, recordingSettings }) => {
  const { appState, updateAppState } = useAppState();
  
  // 🔴 FIXED: Get state from centralized source
  const [localState, setLocalState] = useState({
    apiStatus: 'checking',
    localError: null
  });

  // 🔴 FIXED: Sync with central state instead of managing independently
  useEffect(() => {
    const updateFromCentral = () => {
      const centralState = appInitializer.getCentralState();
      
      // Update our local state based on central state
      setLocalState(prev => ({
        apiStatus: centralState.screenRecorderApiStatus || 'checking',
        localError: centralState.screenRecorderError || null
      }));

      // Update app state with recording info from central state
      updateAppState({
        isRecording: centralState.isRecording || false,
        recordingValidated: centralState.recordingValidated || false,
        recordingDuration: centralState.recordingDuration || 0,
        isPaused: centralState.isPaused || false,
        recordingSettings: centralState.recordingSettings || recordingSettings.recordingSettings
      });
    };

    // Initial sync
    updateFromCentral();

    // Set up periodic sync (will be replaced with proper state subscription later)
    const interval = setInterval(updateFromCentral, 1000);
    
    return () => clearInterval(interval);
  }, [updateAppState, recordingSettings]);

  // 🔴 FIXED: Use centralized recording actions
  const handleStartRecording = useCallback(async () => {
    if (!appInitializer.isReady()) {
      toast.error('App not fully initialized yet');
      return;
    }

    const centralState = appInitializer.getCentralState();
    
    if (centralState.screenRecorderApiStatus !== 'available') {
      toast.error('Screen recording API not available');
      return;
    }

    if (centralState.isRecording) {
      toast.warning('Recording is already in progress');
      return;
    }

    // Validate device selections
    if (!centralState.selectedScreen) {
      toast.error('Please select a screen to record');
      return;
    }

    const screenExists = centralState.availableDevices.screens.find(s => s.id === centralState.selectedScreen);
    if (!screenExists) {
      toast.error(`Selected screen device '${centralState.selectedScreen}' is not available. Please refresh devices and select again.`);
      return;
    }

    // Check audio device if microphone is enabled
    if (centralState.recordingSettings.includeMicrophone) {
      if (!centralState.selectedAudioInput) {
        toast.error('Please select an audio input device or disable microphone recording');
        return;
      }
      
      const audioExists = centralState.availableDevices.audio.find(a => a.id === centralState.selectedAudioInput);
      if (!audioExists) {
        toast.error(`Selected audio device '${centralState.selectedAudioInput}' is not available. Please refresh devices and select again.`);
        return;
      }
    }

    try {
      console.log('🎬 Starting recording via centralized system...');
      
      // Show immediate feedback
      toast.loading('🎬 Starting recording...', { 
        duration: 5000,
        description: `Screen: ${screenExists.name}, Audio: ${centralState.recordingSettings.includeMicrophone ? 'Enabled' : 'Disabled'}`
      });

      // Use centralized recording action
      const actions = appInitializer.getScreenRecorderActions();
      const result = await actions.startRecording();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to start recording');
      }
      
      console.log('✅ Recording started successfully via centralized system');
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      const errorInfo = getErrorMessage(error, centralState.selectedScreen, centralState.selectedAudioInput);
      toast.error(errorInfo.message);
    }
  }, []);

  const handleStopRecording = useCallback(async () => {
    const centralState = appInitializer.getCentralState();
    
    if (!centralState.isRecording) {
      toast.warning('No recording in progress');
      return;
    }

    try {
      console.log('⏹️ Stopping recording via centralized system...');
      
      const actions = appInitializer.getScreenRecorderActions();
      const result = await actions.stopRecording();
      
      if (!result.success && !result.wasAlreadyStopped) {
        throw new Error(result.error || 'Failed to stop recording');
      }
      
      console.log('✅ Recording stopped successfully via centralized system');
      
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      
      if (error.message?.includes('No recording in progress')) {
        toast.info('Recording was already stopped');
      } else {
        toast.error('Failed to stop recording: ' + error.message);
      }
    }
  }, []);

  const handlePauseResume = useCallback(async () => {
    const centralState = appInitializer.getCentralState();
    
    if (!centralState.isRecording || !centralState.recordingValidated) {
      toast.warning('No validated recording in progress');
      return;
    }

    try {
      const actions = appInitializer.getScreenRecorderActions();
      const result = await actions.pauseResume();
      
      if (result.success) {
        toast.success(centralState.isPaused ? '▶️ Recording resumed' : '⏸️ Recording paused');
      } else {
        throw new Error(result.error || 'Failed to pause/resume');
      }
    } catch (error) {
      console.error('❌ Failed to pause/resume recording:', error);
      toast.error('Failed to pause/resume: ' + error.message);
    }
  }, []);

  const cleanup = useCallback(() => {
    console.log('🧹 Screen recorder hook cleanup (minimal since state is centralized)');
    // No major cleanup needed since we don't manage state or events directly
  }, []);

  return {
    // State from centralized source
    apiStatus: localState.apiStatus,
    localError: localState.localError,
    
    // Actions that use centralized methods
    handleStartRecording,
    handleStopRecording,
    handlePauseResume,
    cleanup
  };
};

// src/renderer/whisperdesk-ui/src/hooks/useRecordingSettings.js - FIXED
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAppState } from '@/App';
import { appInitializer } from '../utils/AppInitializer';

export const useRecordingSettings = () => {
  const { updateAppState } = useAppState();
  
  // 🔴 FIXED: Get settings from centralized state
  const [recordingSettings, setRecordingSettings] = useState({
    includeMicrophone: true,
    includeSystemAudio: true,
    autoTranscribe: true,
    recordingDirectory: ''
  });

  // 🔴 FIXED: Sync with central state
  useEffect(() => {
    const updateFromCentral = () => {
      const centralState = appInitializer.getCentralState();
      if (centralState.recordingSettings) {
        setRecordingSettings(centralState.recordingSettings);
      }
    };

    updateFromCentral();
    const interval = setInterval(updateFromCentral, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const updateSetting = useCallback((key, value) => {
    // Update local state immediately for responsiveness
    setRecordingSettings(prev => ({ ...prev, [key]: value }));
    
    // Update central state
    const centralState = appInitializer.getCentralState();
    const newSettings = { ...centralState.recordingSettings, [key]: value };
    appInitializer.updateCentralState({ recordingSettings: newSettings });
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
    selectRecordingDirectory,
    saveRecordingSettings,
    triggerAutoTranscription
  };
};