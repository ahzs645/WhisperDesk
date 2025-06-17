import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import ScreenRecorderServiceRenderer from './ScreenRecorderServiceRenderer'; // ✅ Use renderer service

const ScreenRecorderContext = createContext();

export const useScreenRecorderContext = () => {
  const context = useContext(ScreenRecorderContext);
  if (!context) {
    throw new Error('useScreenRecorderContext must be used within a ScreenRecorderProvider');
  }
  return context;
};

export const ScreenRecorderProvider = ({ children }) => {
  const [state, setState] = useState({
    // Recording state
    isRecording: false,
    isPaused: false,
    recordingDuration: 0,
    recordingValidated: false,
    
    // Device state
    availableDevices: { screens: [], audio: [] },
    selectedScreen: '',
    selectedAudioInput: '',
    devicesInitialized: false,
    loadingDevices: false,
    
    // Settings state
    recordingSettings: {
      includeMicrophone: true,
      includeSystemAudio: false,
      videoQuality: 'medium',
      audioQuality: 'medium',
      recordingDirectory: null,
      autoTranscribe: false
    },
    
    // API state
    apiStatus: 'checking',
    localError: null,
    
    // Debug state
    debugMode: false,
    eventLog: []
  });

  const [service] = useState(() => new ScreenRecorderServiceRenderer()); // ✅ Use renderer service

  // Update state helper
  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Add to event log helper
  const addToEventLog = useCallback((event) => {
    const timestamp = new Date().toLocaleTimeString();
    setState(prev => ({
      ...prev,
      eventLog: [...prev.eventLog.slice(-99), { timestamp, event }]
    }));
  }, []);

  // Initialize service
  useEffect(() => {
    const initializeService = async () => {
      try {
        addToEventLog('Initializing screen recorder service...');
        
        // Check API availability first
        if (!window.electronAPI?.screenRecorder) {
          throw new Error('Screen recorder API not available');
        }

        await service.initialize(updateState, addToEventLog);
        updateState({ apiStatus: 'available' });
        addToEventLog('Service initialized successfully');
        
      } catch (error) {
        console.error('Failed to initialize screen recorder service:', error);
        updateState({ 
          apiStatus: 'unavailable', 
          localError: error.message 
        });
        addToEventLog(`Initialization failed: ${error.message}`);
      }
    };

    initializeService();

    return () => {
      service.cleanup();
    };
  }, [service, updateState, addToEventLog]);

  // Recording actions
  const actions = {
    startRecording: useCallback(async (options = {}) => {
      try {
        updateState({ localError: null });
        
        const recordingOptions = {
          screenId: state.selectedScreen,
          audioInputId: state.selectedAudioInput,
          ...state.recordingSettings,
          ...options
        };

        // Validate required fields
        if (!recordingOptions.screenId) {
          throw new Error('Please select a screen to record');
        }

        if (recordingOptions.includeMicrophone && !recordingOptions.audioInputId) {
          throw new Error('Please select an audio input device or disable microphone');
        }

        await service.startRecording(recordingOptions);
        toast.success('Recording started successfully');
        
      } catch (error) {
        console.error('Failed to start recording:', error);
        updateState({ localError: error.message });
        toast.error(`Failed to start recording: ${error.message}`);
        throw error;
      }
    }, [state.selectedScreen, state.selectedAudioInput, state.recordingSettings, service, updateState]),

    stopRecording: useCallback(async () => {
      try {
        await service.stopRecording();
        toast.success('Recording stopped successfully');
      } catch (error) {
        console.error('Failed to stop recording:', error);
        toast.error(`Failed to stop recording: ${error.message}`);
        throw error;
      }
    }, [service]),

    pauseResume: useCallback(async () => {
      try {
        if (state.isPaused) {
          await service.resumeRecording();
          toast.success('Recording resumed');
        } else {
          await service.pauseRecording();
          toast.success('Recording paused');
        }
      } catch (error) {
        console.error('Failed to pause/resume recording:', error);
        toast.error(`Failed to ${state.isPaused ? 'resume' : 'pause'} recording: ${error.message}`);
        throw error;
      }
    }, [state.isPaused, service]),

    refreshDevices: useCallback(async () => {
      try {
        updateState({ loadingDevices: true, localError: null });
        await service.refreshDevices();
        addToEventLog('Devices refreshed manually');
      } catch (error) {
        console.error('Failed to refresh devices:', error);
        updateState({ localError: error.message });
        toast.error('Failed to refresh devices');
      } finally {
        updateState({ loadingDevices: false });
      }
    }, [service, updateState, addToEventLog]),

    updateSettings: useCallback((newSettings) => {
      updateState({ 
        recordingSettings: { ...state.recordingSettings, ...newSettings } 
      });
      addToEventLog(`Settings updated: ${Object.keys(newSettings).join(', ')}`);
    }, [state.recordingSettings, updateState, addToEventLog]),

    selectScreen: useCallback((screenId) => {
      updateState({ selectedScreen: screenId });
      addToEventLog(`Screen selected: ${screenId}`);
    }, [updateState, addToEventLog]),

    selectAudioInput: useCallback((audioInputId) => {
      updateState({ selectedAudioInput: audioInputId });
      addToEventLog(`Audio input selected: ${audioInputId}`);
    }, [updateState, addToEventLog]),

    toggleDebugMode: useCallback(() => {
      updateState({ debugMode: !state.debugMode });
    }, [state.debugMode, updateState]),

    addToEventLog,

    clearEventLog: useCallback(() => {
      updateState({ eventLog: [] });
    }, [updateState])
  };

  // Auto-select first available devices when they become available
  useEffect(() => {
    if (state.devicesInitialized && !state.selectedScreen && state.availableDevices.screens.length > 0) {
      const firstScreen = state.availableDevices.screens[0];
      updateState({ selectedScreen: firstScreen.id });
      addToEventLog(`Auto-selected screen: ${firstScreen.name}`);
    }
  }, [state.devicesInitialized, state.selectedScreen, state.availableDevices.screens, updateState, addToEventLog]);

  useEffect(() => {
    if (state.devicesInitialized && !state.selectedAudioInput && state.availableDevices.audio.length > 0 && state.recordingSettings.includeMicrophone) {
      const firstAudio = state.availableDevices.audio[0];
      updateState({ selectedAudioInput: firstAudio.id });
      addToEventLog(`Auto-selected audio: ${firstAudio.name}`);
    }
  }, [state.devicesInitialized, state.selectedAudioInput, state.availableDevices.audio, state.recordingSettings.includeMicrophone, updateState, addToEventLog]);

  const contextValue = {
    ...state,
    ...actions,
    service
  };

  return (
    <ScreenRecorderContext.Provider value={contextValue}>
      {children}
    </ScreenRecorderContext.Provider>
  );
};