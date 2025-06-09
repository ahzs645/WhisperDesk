// src/renderer/whisperdesk-ui/src/hooks/useScreenRecorder.js
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
  const hasInitialized = useRef(false); // 🔴 FIXED: Prevent multiple initializations

  // Sync with backend
  const syncStateWithBackend = useCallback(async () => {
    if (!window.electronAPI?.screenRecorder?.getStatus) return;
    
    try {
      const backendStatus = await window.electronAPI.screenRecorder.getStatus();
      
      if (!isComponentMounted.current) return;
      
      // 🔴 FIXED: Only sync recording state if there's a meaningful change
      const frontendRecording = appState.isRecording;
      const backendRecording = backendStatus.isRecording;
      const frontendValidated = appState.recordingValidated;
      const backendValidated = backendStatus.recordingValidated;
      
      // Only update recording state if something actually changed
      if (backendRecording !== frontendRecording || 
          backendStatus.isPaused !== appState.isPaused ||
          backendValidated !== frontendValidated) {
          
        console.log('🔄 Syncing recording state (meaningful change detected)');
        console.log('Frontend state:', { recording: frontendRecording, validated: frontendValidated });
        console.log('Backend state:', { recording: backendRecording, validated: backendValidated });
        
        updateAppState({
          isRecording: backendStatus.isRecording,
          recordingValidated: backendStatus.recordingValidated || false,
          recordingDuration: backendStatus.duration ? Math.floor(backendStatus.duration / 1000) : 0,
          isPaused: backendStatus.isPaused || false
        });
        
        setLocalError(backendStatus.lastError);
      }
      
      // 🔴 FIXED: Only update devices if they actually changed AND user isn't actively using UI
      if (backendStatus.availableDevices && deviceManager.shouldUpdateDevices(backendStatus.availableDevices)) {
        // 🔴 IMPORTANT: Only update devices if not currently recording to prevent dropdown clearing
        if (!appState.isRecording) {
          console.log('📱 Device list changed, updating (safe to update)...');
          deviceManager.updateDevices(backendStatus.availableDevices, true); // Always preserve selections
        } else {
          console.log('📱 Device list changed but recording in progress, skipping update to preserve UI state');
        }
      }
      
    } catch (error) {
      if (isComponentMounted.current) {
        console.warn('Sync failed (non-critical):', error.message);
      }
    }
  }, [appState.isRecording, appState.recordingValidated, appState.isPaused, updateAppState, deviceManager]);

  // Setup event handlers
  const setupEventHandlers = useCallback(() => {
    // 🔴 FIXED: Prevent duplicate event handler setup
    if (Object.keys(eventCleanupRef.current).length > 0) {
      console.log('🔒 Event handlers already set up, skipping...');
      return;
    }
    
    console.log('🔧 Setting up recording event handlers...');
    
    // Clear any existing event handlers first
    Object.values(eventCleanupRef.current).forEach(cleanup => {
      if (typeof cleanup === 'function') cleanup();
    });
    eventCleanupRef.current = {};
    
    // Recording started
    if (window.electronAPI.screenRecorder.onRecordingStarted) {
      eventCleanupRef.current.started = window.electronAPI.screenRecorder.onRecordingStarted((data) => {
        console.log('📹 Recording started event:', data);
        if (isComponentMounted.current) {
          // 🔴 FIXED: Update state properly on start event
          updateAppState({
            isRecording: true,
            recordingValidated: false,
            recordingDuration: 0,
            isPaused: false
          });
          
          setLocalError(null);
          
          // 🔴 FIXED: Better toast handling
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
          
          // 🔴 FIXED: Clear loading toast and show success
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
          // 🔴 FIXED: Immediately reset state on any error
          updateAppState({
            isRecording: false,
            recordingValidated: false,
            recordingDuration: 0,
            isPaused: false
          });
          
          setLocalError(data.error || 'Recording failed');
          
          // 🔴 FIXED: Clear any pending loading toasts
          if (lastToastRef.current) {
            toast.dismiss(lastToastRef.current);
            lastToastRef.current = null;
          }
          
          let errorMessage = data.error || 'Unknown error';
          if (data.suggestion) {
            errorMessage += '. ' + data.suggestion;
          }
          
          // 🔴 FIXED: Better error messages based on error type
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

    console.log('✅ Recording event handlers set up');
  }, [updateAppState, recordingSettings]);

  // Duration timer
  const stopDurationTimer = useCallback(() => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (appState.isRecording && !appState.isPaused && appState.recordingValidated) {
      durationTimer.current = setInterval(() => {
        if (isComponentMounted.current) {
          updateAppState(prev => ({
            ...prev,
            recordingDuration: (prev.recordingDuration || 0) + 1
          }));
        }
      }, 1000);
    } else {
      stopDurationTimer();
    }

    return () => stopDurationTimer();
  }, [appState.isRecording, appState.isPaused, appState.recordingValidated, updateAppState, stopDurationTimer]);

  // Initialize recorder
  const initializeRecorder = useCallback(async () => {
    // 🔴 FIXED: Prevent multiple initializations
    if (hasInitialized.current) {
      console.log('🔒 Screen recorder already initialized, skipping...');
      return;
    }
    
    console.log('🔍 ScreenRecorder: Initializing...');
    
    if (!window.electronAPI?.screenRecorder) {
      setApiStatus('unavailable');
      setLocalError('Screen recording API not available - please run in Electron');
      return;
    }

    try {
      hasInitialized.current = true; // 🔴 FIXED: Mark as initialized early
      setApiStatus('available');
      
      // 🔴 FIXED: Set up IPC event listeners for additional events from main process
      if (window.electronAPI.screenRecorder.onRecordingValidated) {
        // This handles the 'screenRecorder:validated' event from main.js
        window.electronAPI.screenRecorder.onRecordingValidated(() => {
          console.log('✅ Recording validated via IPC event');
          if (isComponentMounted.current) {
            updateAppState({
              recordingValidated: true
            });
            
            setLocalError(null);
            
            if (lastToastRef.current) {
              toast.dismiss(lastToastRef.current);
              lastToastRef.current = null;
            }
            
            toast.success('🎬 Recording validated!', {
              description: 'Screen recording is now active'
            });
          }
        });
      }
      
      setupEventHandlers();
      
      console.log('🔄 Initial state sync...');
      await syncStateWithBackend();
      
      console.log('✅ ScreenRecorder: Initialized successfully');
    } catch (error) {
      console.error('❌ ScreenRecorder: Initialization failed:', error);
      hasInitialized.current = false; // 🔴 FIXED: Reset flag on error
      setLocalError('Failed to initialize screen recorder: ' + error.message);
      setApiStatus('error');
    } finally {
      deviceManager.setLoadingDevices(false);
    }
  }, []); // 🔴 FIXED: Empty dependency array to prevent re-runs

  // Recording actions
  const handleStartRecording = useCallback(async () => {
    if (!window.electronAPI?.screenRecorder?.startRecording) {
      setLocalError('Screen recording API not available');
      toast.error('Screen recording only available in Electron app');
      return;
    }

    if (appState.isRecording) {
      toast.warning('Recording is already in progress');
      return;
    }

    // 🔴 FIXED: Validate device selections before starting
    if (!deviceManager.selectedScreen) {
      toast.error('Please select a screen to record');
      return;
    }

    // 🔴 FIXED: Check if selected screen device actually exists
    const screenExists = deviceManager.availableDevices.screens.find(s => s.id === deviceManager.selectedScreen);
    if (!screenExists) {
      toast.error(`Selected screen device '${deviceManager.selectedScreen}' is not available. Please refresh devices and select again.`);
      console.error('❌ Selected screen device not found:', deviceManager.selectedScreen, 'Available:', deviceManager.availableDevices.screens);
      return;
    }

    // 🔴 FIXED: Check audio device if microphone is enabled
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

      // 🔴 FIXED: Immediately show "starting" state in UI
      updateAppState({
        isRecording: true,
        recordingValidated: false,
        recordingDuration: 0,
        isPaused: false
      });

      // Show immediate feedback
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
      
      // 🔴 FIXED: Don't wait for validation here - let the events handle it
      // The backend will send events and we'll update UI accordingly
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      
      // 🔴 FIXED: Reset state on error
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

  // Cleanup
  const cleanup = useCallback(() => {
    console.log('🧹 Screen recorder cleanup');
    isComponentMounted.current = false;
    hasInitialized.current = false; // 🔴 FIXED: Reset initialization flag
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

  // Setup sync interval and event handlers
  useEffect(() => {
    isComponentMounted.current = true;
    
    // 🔴 FIXED: Only set up sync interval, don't set up events here
    syncIntervalRef.current = setInterval(syncStateWithBackend, 3000);
    
    return cleanup;
  }, []); // 🔴 FIXED: Empty dependency array to run only once

  // 🔴 FIXED: Separate effect for initialization to prevent re-runs
  useEffect(() => {
    if (!hasInitialized.current) {
      // 🔴 FIXED: Set up event handlers early but only once
      setupEventHandlers();
    }
  }, []); // 🔴 FIXED: Empty dependency array to run only once

  return {
    // State
    apiStatus,
    localError,
    
    // Actions
    initializeRecorder,
    handleStartRecording,
    handleStopRecording,
    handlePauseResume,
    cleanup
  };
};