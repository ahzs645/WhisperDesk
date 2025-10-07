import { useScreenRecorderContext } from './ScreenRecorderProvider';

// Re-export the main context hook
export { useScreenRecorderContext } from './ScreenRecorderProvider';

// Custom hooks for specific screen recorder functionality
export const useScreenRecorderActions = () => {
  const {
    startRecording,
    stopRecording,
    pauseResume,
    refreshDevices,
    updateSettings,
    selectScreen,
    selectAudioInput
  } = useScreenRecorderContext();

  return {
    startRecording,
    stopRecording,
    pauseResume,
    refreshDevices,
    updateSettings,
    selectScreen,
    selectAudioInput
  };
};

export const useScreenRecorderState = () => {
  const {
    isRecording,
    isPaused,
    recordingDuration,
    recordingValidated,
    availableDevices,
    selectedScreen,
    selectedAudioInput,
    recordingSettings,
    apiStatus,
    localError,
    devicesInitialized,
    loadingDevices
  } = useScreenRecorderContext();

  return {
    isRecording,
    isPaused,
    recordingDuration,
    recordingValidated,
    availableDevices,
    selectedScreen,
    selectedAudioInput,
    recordingSettings,
    apiStatus,
    localError,
    devicesInitialized,
    loadingDevices
  };
};

export const useScreenRecorderDebug = () => {
  const {
    debugMode,
    eventLog,
    service,
    toggleDebugMode,
    addToEventLog,
    clearEventLog
  } = useScreenRecorderContext();

  return {
    debugMode,
    eventLog,
    service,
    toggleDebugMode,
    addToEventLog,
    clearEventLog
  };
}; 