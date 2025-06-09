// src/renderer/whisperdesk-ui/src/hooks/useScreenRecorder.js - FIXED
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useAppState } from '@/App';
import { formatDuration, getErrorMessage } from '../utils/recordingUtils';

export const useScreenRecorder = ({ deviceManager, recordingSettings }) => {
  const { appState, updateAppState } = useAppState();
  
  const [apiStatus, setApiStatus] = useState('checking');
  const [localError, setLocalError] = useState(null);
  
  const durationTimer = useRef(null);
  const eventCleanupRef = useRef({});
  const isComponentMounted = useRef(true);
  const lastToastRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const initializationComplete = useRef(false);

  // Define functions before they're used
  const startDurationTimer = useCallback(() => {
    if (durationTimer.current) return;
    
    durationTimer.current = setInterval(() => {
      if (isComponentMounted.current) {
        updateAppState(prev => ({
          recordingDuration: (prev.recordingDuration || 0) + 1
        }));
      }
    }, 1000);
  }, [updateAppState]);

  const stopDurationTimer = useCallback(() => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }
  }, []);

  // 🔴 FIXED: Actually update apiStatus based on backend state
  const syncStateWithBackend = useCallback(async () => {
    if (!isComponentMounted.current) return;
    
    try {
      console.log('🔄 Syncing screen recorder state with backend...');
      
      // Check if API is available first
      if (!window.electronAPI?.screenRecorder?.getStatus) {
        console.warn('❌ Screen recorder API not available');
        if (isComponentMounted.current) {
          setApiStatus('unavailable');
          setLocalError('Screen recorder API not available');
        }
        return;
      }

      const status = await window.electronAPI.screenRecorder.getStatus();
      console.log('📊 Backend status:', status);
      
      if (isComponentMounted.current) {
        // 🔴 FIXED: Update apiStatus based on backend status
        if (status.error) {
          setApiStatus('unavailable');
          setLocalError(status.error);
          console.warn('❌ Backend reports error:', status.error);
        } else {
          setApiStatus('available');
          setLocalError(null);
          console.log('✅ Screen recorder API is available');
        }

        // Update recording state
        const wasRecording = appState.isRecording;
        const newState = {
          isRecording: status.isRecording || false,
          recordingValidated: status.recordingValidated || false,
          isPaused: status.isPaused || false
        };

        // Only update duration if we have a valid backend duration
        if (status.duration && status.isRecording) {
          newState.recordingDuration = Math.floor(status.duration / 1000);
        } else if (!status.isRecording && wasRecording) {
          // Recording stopped, reset duration
          newState.recordingDuration = 0;
        }

        updateAppState(newState);

        // Handle timer state
        if (status.isRecording && !status.isPaused) {
          startDurationTimer();
        } else {
          stopDurationTimer();
        }

        // 🔴 FIXED: Update devices if available and not already initialized
        if (status.availableDevices && !initializationComplete.current) {
          console.log('📱 Updating devices from backend status:', status.availableDevices);
          deviceManager.updateDevices(status.availableDevices, false); // Don't preserve selections on first sync
          initializationComplete.current = true;
        }
      }
    } catch (error) {
      console.error('❌ Failed to sync recorder state:', error);
      if (isComponentMounted.current) {
        setApiStatus('unavailable');
        setLocalError(error.message);
      }
    }
  }, [updateAppState, startDurationTimer, stopDurationTimer, deviceManager, appState.isRecording]);

  // 🔴 FIXED: Initialize immediately and set up sync interval
  useEffect(() => {
    isComponentMounted.current = true;
    console.log('🚀 Screen recorder hook initializing...');
    
    // Do initial sync immediately
    syncStateWithBackend();
    
    // Set up sync interval (less frequent to avoid spam)
    syncIntervalRef.current = setInterval(syncStateWithBackend, 5000);
    
    return () => {
      isComponentMounted.current = false;
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [syncStateWithBackend]);

  // 🔴 FIXED: Set up event handlers only once and coordinate with global handlers
  useEffect(() => {
    if (!window.electronAPI?.screenRecorder || Object.keys(eventCleanupRef.current).length > 0) {
      return; // API not available or handlers already set up
    }

    console.log('🔧 Setting up screen recorder event handlers...');
    
    // Recording started
    if (window.electronAPI.screenRecorder.onRecordingStarted) {
      eventCleanupRef.current.started = window.electronAPI.screenRecorder.onRecordingStarted((data) => {
        console.log('📹 Recording started event:', data);
        if (isComponentMounted.current) {
          updateAppState({
            isRecording: true,
            recordingValidated: false,
            recordingDuration: 0,
            isPaused: false
          });
          
          setLocalError(null);
          setApiStatus('available'); // Confirm API is working
          
          if (lastToastRef.current) {
            toast.dismiss(lastToastRef.current);
          }
          
          lastToastRef.current = toast.loading('🎬 Validating recording...', {
            duration: Infinity,
            description: 'Checking for video frames...'
          });
        }
      });
    }

    // Recording validated
    if (window.electronAPI.screenRecorder.onRecordingValidated) {
      eventCleanupRef.current.validated = window.electronAPI.screenRecorder.onRecordingValidated(() => {
        console.log('✅ Recording validated event');
        if (isComponentMounted.current) {
          updateAppState({
            recordingValidated: true
          });
          
          setLocalError(null);
          
          if (lastToastRef.current) {
            toast.dismiss(lastToastRef.current);
            lastToastRef.current = null;
          }
          
          toast.success('🎬 Recording active!', {
            description: 'Screen recording is now capturing frames'
          });
        }
      });
    }

    // Recording completed
    if (window.electronAPI.screenRecorder.onRecordingCompleted) {
      eventCleanupRef.current.completed = window.electronAPI.screenRecorder.onRecordingCompleted((data) => {
        console.log('✅ Recording completed event:', data);
        if (isComponentMounted.current) {
          updateAppState({
            isRecording: false,
            recordingValidated: false,
            recordingDuration: 0,
            isPaused: false
          });
          
          setLocalError(null);
          
          const duration = data.duration ? Math.floor(data.duration / 1000) : 0;
          toast.success(`🎬 Recording saved! Duration: ${formatDuration(duration)}`);
          
          // Auto-select the recorded file
          if (data.audioPath) {
            const fileInfo = {
              path: data.audioPath,
              name: data.audioPath.split('/').pop() || data.audioPath.split('\\').pop(),
              size: 0
            };
            updateAppState({ selectedFile: fileInfo });
            
            // Auto-transcribe if enabled
            if (recordingSettings.recordingSettings.autoTranscribe) {
              setTimeout(() => {
                recordingSettings.triggerAutoTranscription(fileInfo);
              }, 1000);
            }
          }
        }
      });
    }

    // Recording error
    if (window.electronAPI.screenRecorder.onRecordingError) {
      eventCleanupRef.current.error = window.electronAPI.screenRecorder.onRecordingError((data) => {
        console.error('❌ Recording error event:', data);
        if (isComponentMounted.current) {
          updateAppState({
            isRecording: false,
            recordingValidated: false,
            recordingDuration: 0,
            isPaused: false
          });
          
          setLocalError(data.error || 'Recording failed');
          
          if (lastToastRef.current) {
            toast.dismiss(lastToastRef.current);
            lastToastRef.current = null;
          }
          
          let errorMessage = data.error || 'Unknown error';
          if (data.suggestion) {
            errorMessage += '. ' + data.suggestion;
          }
          
          if (errorMessage.includes('code null')) {
            errorMessage = 'Recording process crashed immediately. This usually means invalid device selection or permission issues.';
          }
          
          toast.error('❌ Recording failed: ' + errorMessage, {
            duration: 8000,
            description: 'Check device selection and permissions'
          });
        }
      });
    }

    // Recording progress
    if (window.electronAPI.screenRecorder.onRecordingProgress) {
      eventCleanupRef.current.progress = window.electronAPI.screenRecorder.onRecordingProgress((data) => {
        if (isComponentMounted.current && data.duration) {
          const backendSeconds = Math.floor(data.duration / 1000);
          const frontendSeconds = appState.recordingDuration;
          
          if (Math.abs(backendSeconds - frontendSeconds) > 2) {
            updateAppState({ recordingDuration: backendSeconds });
          }
        }
      });
    }

    console.log('✅ Screen recorder event handlers set up');

    return () => {
      Object.values(eventCleanupRef.current).forEach(cleanup => {
        if (typeof cleanup === 'function') cleanup();
      });
      eventCleanupRef.current = {};
    };
  }, [updateAppState, recordingSettings]);

  // Cleanup
  const cleanup = useCallback(() => {
    console.log('🧹 Screen recorder cleanup');
    isComponentMounted.current = false;
    stopDurationTimer();
    
    Object.values(eventCleanupRef.current).forEach(cleanup => {
      if (typeof cleanup === 'function') cleanup();
    });
    eventCleanupRef.current = {};
    
    if (lastToastRef.current) {
      toast.dismiss(lastToastRef.current);
    }
    
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
  }, [stopDurationTimer]);

  // Recording actions (keeping the same but with better error handling)
  const handleStartRecording = useCallback(async () => {
    if (!window.electronAPI?.screenRecorder?.startRecording) {
      setLocalError('Screen recording API not available');
      setApiStatus('unavailable');
      toast.error('Screen recording only available in Electron app');
      return;
    }

    if (appState.isRecording) {
      toast.warning('Recording is already in progress');
      return;
    }

    // Validate device selections before starting
    if (!deviceManager.selectedScreen) {
      toast.error('Please select a screen to record');
      return;
    }

    const screenExists = deviceManager.availableDevices.screens.find(s => s.id === deviceManager.selectedScreen);
    if (!screenExists) {
      toast.error(`Selected screen device '${deviceManager.selectedScreen}' is not available. Please refresh devices and select again.`);
      console.error('❌ Selected screen device not found:', deviceManager.selectedScreen, 'Available:', deviceManager.availableDevices.screens);
      return;
    }

    if (recordingSettings.recordingSettings.includeMicrophone) {
      if (!deviceManager.selectedAudioInput) {
        toast.error('Please select an audio input device or disable microphone recording');
        return;
      }
      
      const audioExists = deviceManager.availableDevices.audio.find(a => a.id === deviceManager.selectedAudioInput);
      if (!audioExists) {
        toast.error(`Selected audio device '${deviceManager.selectedAudioInput}' is not available. Please refresh devices and select again.`);
        console.error('❌ Selected audio device not found:', deviceManager.selectedAudioInput, 'Available:', deviceManager.availableDevices.audio);
        return;
      }
    }

    try {
      setLocalError(null);
      console.log('🎬 Starting enhanced screen recording...');
      console.log('🎯 Validated devices - Screen:', deviceManager.selectedScreen, 'Audio:', deviceManager.selectedAudioInput);

      updateAppState({
        isRecording: true,
        recordingValidated: false,
        recordingDuration: 0,
        isPaused: false
      });

      if (lastToastRef.current) {
        toast.dismiss(lastToastRef.current);
      }
      lastToastRef.current = toast.loading('🎬 Starting recording...', { 
        duration: Infinity,
        description: `Screen: ${screenExists.name}, Audio: ${recordingSettings.recordingSettings.includeMicrophone ? 'Enabled' : 'Disabled'}`
      });

      const options = {
        screenId: deviceManager.selectedScreen,
        audioInputId: deviceManager.selectedAudioInput,
        includeMicrophone: recordingSettings.recordingSettings.includeMicrophone,
        includeSystemAudio: recordingSettings.recordingSettings.includeSystemAudio,
        audioQuality: 'medium',
        videoQuality: 'medium',
        recordingDirectory: recordingSettings.recordingSettings.recordingDirectory || undefined
      };

      console.log('🎯 Recording with validated options:', options);
      
      const result = await window.electronAPI.screenRecorder.startRecording(options);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to start recording');
      }
      
      console.log('✅ Recording API call successful:', result);
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      
      updateAppState({
        isRecording: false,
        recordingValidated: false,
        recordingDuration: 0,
        isPaused: false
      });
      
      setLocalError(error.message || 'Failed to start recording');
      
      if (lastToastRef.current) {
        toast.dismiss(lastToastRef.current);
        lastToastRef.current = null;
      }
      
      const errorInfo = getErrorMessage(error, deviceManager.selectedScreen, deviceManager.selectedAudioInput);
      toast.error(errorInfo.message);
    }
  }, [appState.isRecording, deviceManager, recordingSettings, updateAppState]);

  const handleStopRecording = useCallback(async () => {
    if (!window.electronAPI?.screenRecorder?.stopRecording) {
      setLocalError('Screen recording API not available');
      return;
    }

    if (!appState.isRecording) {
      toast.warning('No recording in progress');
      return;
    }

    try {
      setLocalError(null);
      console.log('⏹️ Stopping enhanced screen recording...');
      
      const result = await window.electronAPI.screenRecorder.stopRecording();
      
      if (!result.success && !result.wasAlreadyStopped) {
        throw new Error(result.error || 'Failed to stop recording');
      }
      
      console.log('✅ Recording stopped successfully:', result);
      
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      
      if (error.message?.includes('No recording in progress')) {
        updateAppState({
          isRecording: false,
          recordingValidated: false,
          recordingDuration: 0,
          isPaused: false
        });
        setLocalError(null);
        toast.info('Recording was already stopped');
      } else {
        setLocalError(error.message || 'Failed to stop recording');
        toast.error('Failed to stop recording: ' + error.message);
      }
    }
  }, [appState.isRecording, updateAppState]);

  const handlePauseResume = useCallback(async () => {
    if (!window.electronAPI?.screenRecorder) {
      setLocalError('Screen recording API not available');
      return;
    }

    if (!appState.isRecording || !appState.recordingValidated) {
      toast.warning('No validated recording in progress');
      return;
    }

    try {
      setLocalError(null);
      
      if (appState.isPaused) {
        console.log('▶️ Resuming recording...');
        const result = await window.electronAPI.screenRecorder.resumeRecording();
        if (result.success) {
          updateAppState({ isPaused: false });
          toast.success('▶️ Recording resumed');
        } else {
          throw new Error(result.error || 'Failed to resume');
        }
      } else {
        console.log('⏸️ Pausing recording...');
        const result = await window.electronAPI.screenRecorder.pauseRecording();
        if (result.success) {
          updateAppState({ isPaused: true });
          toast.success('⏸️ Recording paused');
        } else {
          throw new Error(result.error || 'Failed to pause');
        }
      }
    } catch (error) {
      console.error('❌ Failed to pause/resume recording:', error);
      setLocalError(error.message || 'Failed to pause/resume recording');
      toast.error('Failed to pause/resume: ' + error.message);
    }
  }, [appState.isRecording, appState.recordingValidated, appState.isPaused, updateAppState]);

  return {
    // State
    apiStatus,
    localError,
    
    // Actions
    handleStartRecording,
    handleStopRecording,
    handlePauseResume,
    cleanup
  };
};