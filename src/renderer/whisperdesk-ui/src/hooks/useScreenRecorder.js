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
      
      // Only update if values have actually changed
      setLocalState(prev => {
        const newApiStatus = centralState.screenRecorderApiStatus || 'checking';
        const newLocalError = centralState.screenRecorderError || null;
        
        if (prev.apiStatus === newApiStatus && prev.localError === newLocalError) {
          return prev;
        }
        
        return {
          apiStatus: newApiStatus,
          localError: newLocalError
        };
      });

      // Only update app state if values have changed
      const newRecordingState = {
        isRecording: centralState.isRecording || false,
        recordingValidated: centralState.recordingValidated || false,
        recordingDuration: centralState.recordingDuration || 0,
        isPaused: centralState.isPaused || false,
        recordingSettings: centralState.recordingSettings || recordingSettings.recordingSettings
      };

      // Compare with current app state before updating
      if (
        appState.isRecording !== newRecordingState.isRecording ||
        appState.recordingValidated !== newRecordingState.recordingValidated ||
        appState.recordingDuration !== newRecordingState.recordingDuration ||
        appState.isPaused !== newRecordingState.isPaused ||
        JSON.stringify(appState.recordingSettings) !== JSON.stringify(newRecordingState.recordingSettings)
      ) {
        updateAppState(newRecordingState);
      }
    };

    // Set up interval to check for updates
    const intervalId = setInterval(updateFromCentral, 1000);
    
    // Initial update
    updateFromCentral();
    
    return () => clearInterval(intervalId);
  }, [appState.isRecording, appState.recordingValidated, appState.recordingDuration, appState.isPaused, appState.recordingSettings, recordingSettings.recordingSettings]);

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