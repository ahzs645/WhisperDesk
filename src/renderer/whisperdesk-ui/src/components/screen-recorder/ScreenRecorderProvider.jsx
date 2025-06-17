import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ScreenRecorderService } from './ScreenRecorderService';

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

  const [service] = useState(() => new ScreenRecorderService());

  // Update state helper
  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Initialize service
  useEffect(() => {
    const initializeService = async () => {
      try {
        // Pass both updateState and addToEventLog to service
        await service.initialize(updateState, (event) => {
          const timestamp = new Date().toLocaleTimeString();
          setState(prev => ({
            ...prev,
            eventLog: [...prev.eventLog.slice(-99), { timestamp, event }]
          }));
        });
        updateState({ apiStatus: 'available' });
      } catch (error) {
        console.error('Failed to initialize screen recorder service:', error);
        updateState({ 
          apiStatus: 'unavailable', 
          localError: error.message 
        });
      }
    };

    initializeService();

    return () => {
      service.cleanup();
    };
  }, [service, updateState]);

  // Recording actions
  const actions = {
    startRecording: useCallback(async (options = {}) => {
      try {
        const recordingOptions = {
          screenId: state.selectedScreen,
          audioInputId: state.selectedAudioInput,
          ...state.recordingSettings,
          ...options
        };

        await service.startRecording(recordingOptions);
        toast.success('Recording started successfully');
      } catch (error) {
        console.error('Failed to start recording:', error);
        toast.error(`Failed to start recording: ${error.message}`);
        throw error;
      }
    }, [state.selectedScreen, state.selectedAudioInput, state.recordingSettings, service]),

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
        updateState({ loadingDevices: true });
        await service.refreshDevices();
      } catch (error) {
        console.error('Failed to refresh devices:', error);
        toast.error('Failed to refresh devices');
      } finally {
        updateState({ loadingDevices: false });
      }
    }, [service, updateState]),

    updateSettings: useCallback((newSettings) => {
      updateState({ 
        recordingSettings: { ...state.recordingSettings, ...newSettings } 
      });
    }, [state.recordingSettings, updateState]),

    selectScreen: useCallback((screenId) => {
      updateState({ selectedScreen: screenId });
    }, [updateState]),

    selectAudioInput: useCallback((audioInputId) => {
      updateState({ selectedAudioInput: audioInputId });
    }, [updateState]),

    toggleDebugMode: useCallback(() => {
      updateState({ debugMode: !state.debugMode });
    }, [state.debugMode, updateState]),

    addToEventLog: useCallback((event) => {
      const timestamp = new Date().toLocaleTimeString();
      setState(prev => ({
        ...prev,
        eventLog: [...prev.eventLog.slice(-99), { timestamp, event }]
      }));
    }, []),

    clearEventLog: useCallback(() => {
      updateState({ eventLog: [] });
    }, [updateState])
  };

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