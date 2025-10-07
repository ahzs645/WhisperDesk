import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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

  // Load recording settings from backend
  useEffect(() => {
    const loadRecordingSettings = async () => {
      try {
        if (window.electronAPI?.settings?.getAll) {
          const allSettings = await window.electronAPI.settings.getAll();
          
          // Extract recording-related settings
          const recordingSettings = {
            includeMicrophone: allSettings.includeMicrophone ?? true,
            includeSystemAudio: allSettings.includeSystemAudio ?? false,
            videoQuality: allSettings.videoQuality ?? 'medium',
            audioQuality: allSettings.audioQuality ?? 'medium',
            recordingDirectory: allSettings.recordingDirectory ?? null,
            autoTranscribe: allSettings.autoTranscribeRecordings ?? false
          };
          
          setState(prev => ({
            ...prev,
            recordingSettings: {
              ...prev.recordingSettings,
              ...recordingSettings
            }
          }));
          console.log('✅ Recording settings loaded from backend:', recordingSettings);
        }
      } catch (error) {
        console.error('❌ Failed to load recording settings:', error);
      }
    };

    loadRecordingSettings();
  }, []);

  // ✅ ADDED: Track recording state to prevent conflicts
  const isRecordingRef = useRef(false);

  // Update state helper with recording state tracking
  const updateState = useCallback((updates) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      
      // Track recording state changes
      if ('isRecording' in updates) {
        isRecordingRef.current = updates.isRecording;
        
        // Reset duration when starting/stopping recording
        if (updates.isRecording && !prev.isRecording) {
          newState.recordingDuration = 0;
        } else if (!updates.isRecording && prev.isRecording) {
          newState.recordingDuration = 0;
        }
      }
      
      return newState;
    });
  }, []);

  // Add to event log helper
  const addToEventLog = useCallback((event) => {
    const timestamp = new Date().toLocaleTimeString();
    setState(prev => ({
      ...prev,
      eventLog: [...prev.eventLog.slice(-99), { timestamp, event }]
    }));
  }, []);

  // Pass recording state to service
  useEffect(() => {
    if (service) {
      service.isRecording = isRecordingRef.current;
    }
  }, [service, state.isRecording]);

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

        // Map recordingDirectory to outputPath for backend compatibility
        if (recordingOptions.recordingDirectory) {
          recordingOptions.outputPath = recordingOptions.recordingDirectory;
          delete recordingOptions.recordingDirectory;
        }

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
        const result = await service.stopRecording();
        
        // The recording should complete successfully now
        if (result && result.success !== false) {
          toast.success('Recording stopped and saved successfully!');
          
          // If we have a path, show where it was saved
          if (result.outputPath) {
            addToEventLog(`Recording saved to: ${result.outputPath}`);
            
            // Check if auto-transcription is enabled
            console.log('🔍 Checking auto-transcription setting:', state.recordingSettings.autoTranscribe);
            console.log('🔍 Full recording settings:', state.recordingSettings);
            if (state.recordingSettings.autoTranscribe) {
              console.log('🤖 Auto-transcription enabled, triggering transcription...');
              
              // For CapRecorder format, look for the audio file in the segments folder
              const recordingPath = result.outputPath;
              
              // Try multiple possible audio file locations/formats
              const possibleAudioPaths = [
                `${recordingPath}/content/segments/segment-0/system_audio.ogg`,
                `${recordingPath}/content/segments/segment-0/system_audio.wav`,
                `${recordingPath}/content/segments/segment-0/audio.ogg`,
                `${recordingPath}/content/segments/segment-0/audio.wav`,
                `${recordingPath}/content/segments/segment-0/display.mp4`, // Video file as fallback
                `${recordingPath}/display.mp4`, // Alternative structure
                result.outputPath // Ultimate fallback to recording folder
              ];
              
              console.log('🔍 Searching for audio files in:', recordingPath);
              console.log('📁 Will try these paths in order:', possibleAudioPaths);
              
              // Prefer audio file over video file for transcription
              // Audio files are more efficient and purpose-built for transcription
              const videoPath = `${recordingPath}/content/segments/segment-0/display.mp4`;
              const audioPath = `${recordingPath}/content/segments/segment-0/system_audio.ogg`;
              
              // Create file info object for transcription
              // Use audio file as the primary source for transcription
              const fileInfo = {
                path: audioPath, // Use actual audio file for transcription
                name: `Recording Audio (${new Date().toLocaleTimeString()})`,
                size: 0,
                originalAudioPath: audioPath, // Keep reference to audio file
                note: 'Using audio file for transcription (OGG converted to WAV if needed)'
              };
              
              console.log('📁 Video file info for auto-transcription:', fileInfo);
              console.log('� Using video file at:', videoPath);
              console.log('🎵 Audio file available at:', audioPath);
              
              // Trigger auto-transcription event after a short delay
              setTimeout(() => {
                const event = new CustomEvent('autoTranscribe', { 
                  detail: { file: fileInfo } 
                });
                window.dispatchEvent(event);
                console.log('🚀 Auto-transcription event dispatched with audio file');
                toast.info('🤖 Starting auto-transcription from audio...');
              }, 1000);
            } else {
              console.log('ℹ️ Auto-transcription disabled in settings');
            }
          }
        } else {
          // Even if there's an issue, the recording was stopped
          toast.warning('Recording stopped but there may have been a save issue');
          addToEventLog(`Recording stopped with potential save issues: ${result?.error || 'Unknown error'}`);
        }
        
        // Update state to reflect recording stopped
        updateState({ 
          isRecording: false, 
          recordingValidated: false, 
          isPaused: false,
          recordingDuration: 0,
          localError: null 
        });
        
      } catch (error) {
        console.error('Failed to stop recording:', error);
        
        // Since the saveRecordingFile API is working, most errors should be minor
        toast.warning('Recording stopped - check your recordings folder');
        addToEventLog(`Recording stopped with issues: ${error.message}`);
        
        // Still update state to show recording stopped
        updateState({ 
          isRecording: false, 
          recordingValidated: false, 
          isPaused: false,
          recordingDuration: 0,
          localError: null 
        });
      }
    }, [service, updateState, addToEventLog, state.recordingSettings]),

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

    updateSettings: useCallback(async (newSettings) => {
      updateState({ 
        recordingSettings: { ...state.recordingSettings, ...newSettings } 
      });
      addToEventLog(`Settings updated: ${Object.keys(newSettings).join(', ')}`);
      
      // Save to backend using individual setting keys
      try {
        if (window.electronAPI?.settings?.set) {
          const settingsMap = {
            includeMicrophone: 'includeMicrophone',
            includeSystemAudio: 'includeSystemAudio',
            videoQuality: 'videoQuality',
            audioQuality: 'audioQuality',
            recordingDirectory: 'recordingDirectory',
            autoTranscribe: 'autoTranscribeRecordings'
          };
          
          for (const [key, value] of Object.entries(newSettings)) {
            const settingKey = settingsMap[key] || key;
            await window.electronAPI.settings.set(settingKey, value);
          }
          console.log('✅ Recording settings saved to backend');
        }
      } catch (error) {
        console.error('❌ Failed to save recording settings to backend:', error);
      }
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