// src/renderer/whisperdesk-ui/src/components/EnhancedScreenRecorder.jsx - COMPREHENSIVE FIX
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mic, 
  Square, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Monitor,
  Speaker,
  Play,
  Pause,
  FolderOpen,
  Settings,
  RefreshCw,
  Video,
  Clock,
  Zap
} from 'lucide-react';
import { useAppState } from '@/App';
import { toast } from 'sonner';

export function EnhancedScreenRecorder() {
  const { appState, updateAppState } = useAppState();
  
  // FIXED: Simplified and more reliable state management
  const [recordingState, setRecordingState] = useState({
    isRecording: false,
    isPaused: false,
    duration: 0,
    startTime: null,
    lastPath: null,
    error: null,
    recordingValidated: false
  });
  
  // Device management
  const [availableDevices, setAvailableDevices] = useState({ screens: [], audio: [] });
  const [selectedScreen, setSelectedScreen] = useState('1');  // Changed default to '1'
  const [selectedAudioInput, setSelectedAudioInput] = useState('0');
  const [loadingDevices, setLoadingDevices] = useState(true);
  
  // Recording settings
  const [recordingSettings, setRecordingSettings] = useState({
    includeMicrophone: true,
    includeSystemAudio: true,
    autoTranscribe: true,
    recordingDirectory: ''
  });
  
  // Status and error handling
  const [apiStatus, setApiStatus] = useState('checking');
  
  // Refs for cleanup and timers
  const durationTimer = useRef(null);
  const eventCleanupRef = useRef({});
  const isComponentMounted = useRef(true);
  const lastToastRef = useRef(null);
  const syncIntervalRef = useRef(null);

  // NEW: More frequent and reliable state sync
  const syncStateWithBackend = useCallback(async () => {
    if (!window.electronAPI?.screenRecorder?.getStatus) return;
    
    try {
      const backendStatus = await window.electronAPI.screenRecorder.getStatus();
      
      if (isComponentMounted.current) {
        const frontendRecording = recordingState.isRecording;
        const backendRecording = backendStatus.isRecording;
        
        // Detect state mismatches and sync
        if (backendRecording !== frontendRecording || 
            backendStatus.isPaused !== recordingState.isPaused ||
            backendStatus.recordingValidated !== recordingState.recordingValidated) {
            
          console.log('🔄 Syncing recording state:', { 
            backend: backendStatus, 
            frontend: recordingState 
          });
          
          setRecordingState(prev => ({
            ...prev,
            isRecording: backendStatus.isRecording,
            isPaused: backendStatus.isPaused,
            error: backendStatus.lastError,
            recordingValidated: backendStatus.recordingValidated || false,
            lastPath: backendStatus.audioPath
          }));
          
          // Update timer if recording state changed
          if (backendRecording && !frontendRecording && backendStatus.duration) {
            const calculatedStartTime = Date.now() - backendStatus.duration;
            setRecordingState(prev => ({
              ...prev,
              startTime: calculatedStartTime,
              duration: Math.floor(backendStatus.duration / 1000)
            }));
          }
        }
        
        // Update available devices if changed
        if (backendStatus.availableDevices && 
            JSON.stringify(backendStatus.availableDevices) !== JSON.stringify(availableDevices)) {
          const devices = backendStatus.availableDevices;
          setAvailableDevices({
            screens: devices.screens?.map((id, index) => ({ 
              id, 
              name: `Screen ${parseInt(id) + 1}` 
            })) || [],
            audio: devices.audio?.map((id, index) => ({ 
              id, 
              name: `Audio Input ${parseInt(id) + 1}` 
            })) || []
          });
        }
      }
    } catch (error) {
      console.warn('Failed to sync state with backend:', error);
    }
  }, [recordingState.isRecording, recordingState.isPaused, recordingState.recordingValidated, availableDevices]);

  useEffect(() => {
    isComponentMounted.current = true;
    initializeRecorder();
    loadRecordingSettings();
    
    // More frequent sync for better reliability
    syncIntervalRef.current = setInterval(syncStateWithBackend, 1000);
    
    return () => {
      isComponentMounted.current = false;
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      cleanup();
    };
  }, []);

  // FIXED: Better duration timer that doesn't rely on progress events
  useEffect(() => {
    if (recordingState.isRecording && !recordingState.isPaused && recordingState.startTime) {
      durationTimer.current = setInterval(() => {
        if (isComponentMounted.current) {
          const elapsed = Math.floor((Date.now() - recordingState.startTime) / 1000);
          setRecordingState(prev => ({ ...prev, duration: elapsed }));
        }
      }, 1000);
    } else {
      stopDurationTimer();
    }

    return () => stopDurationTimer();
  }, [recordingState.isRecording, recordingState.isPaused, recordingState.startTime]);

  const stopDurationTimer = () => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }
  };

  const initializeRecorder = async () => {
    console.log('🔍 EnhancedScreenRecorder: Initializing...');
    
    if (!window.electronAPI?.screenRecorder) {
      setApiStatus('unavailable');
      setRecordingState(prev => ({ 
        ...prev, 
        error: 'Screen recording API not available - please run in Electron' 
      }));
      return;
    }

    try {
      setApiStatus('available');
      
      // Set up event handlers
      setupEventHandlers();
      
      // Load available devices and sync initial state
      await refreshDevices();
      await syncStateWithBackend();
      
      console.log('✅ EnhancedScreenRecorder: Initialized successfully');
    } catch (error) {
      console.error('❌ EnhancedScreenRecorder: Initialization failed:', error);
      setRecordingState(prev => ({ 
        ...prev, 
        error: 'Failed to initialize screen recorder: ' + error.message 
      }));
      setApiStatus('error');
    } finally {
      setLoadingDevices(false);
    }
  };

  const setupEventHandlers = () => {
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
          setRecordingState(prev => ({
            ...prev,
            isRecording: true,
            isPaused: false,
            startTime: Date.now(),
            duration: 0,
            error: null,
            lastPath: data.audioPath,
            recordingValidated: false  // Will be set to true when first frames captured
          }));
          
          // Dismiss any previous error toast
          if (lastToastRef.current) {
            toast.dismiss(lastToastRef.current);
          }
          
          lastToastRef.current = toast.loading('🎬 Recording starting...', {
            duration: Infinity
          });
        }
      });
    }

    // NEW: Recording validated event
    if (window.electronAPI.screenRecorder.onRecordingValidated) {
      eventCleanupRef.current.validated = window.electronAPI.screenRecorder.onRecordingValidated(() => {
        console.log('✅ Recording validated event');
        if (isComponentMounted.current) {
          setRecordingState(prev => ({
            ...prev,
            recordingValidated: true,
            error: null
          }));
          
          // Update toast
          if (lastToastRef.current) {
            toast.dismiss(lastToastRef.current);
          }
          toast.success('🎬 Recording active!');
        }
      });
    }

    // Recording completed
    if (window.electronAPI.screenRecorder.onRecordingCompleted) {
      eventCleanupRef.current.completed = window.electronAPI.screenRecorder.onRecordingCompleted((data) => {
        console.log('✅ Recording completed event:', data);
        if (isComponentMounted.current) {
          setRecordingState(prev => ({
            ...prev,
            isRecording: false,
            isPaused: false,
            duration: 0,
            startTime: null,
            lastPath: data.audioPath,
            error: null,
            recordingValidated: false
          }));
          
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
            if (recordingSettings.autoTranscribe) {
              setTimeout(() => {
                triggerAutoTranscription(fileInfo);
              }, 1000);
            }
          }
        }
      });
    }

    // IMPROVED: Better error handling with specific messages
    if (window.electronAPI.screenRecorder.onRecordingError) {
      eventCleanupRef.current.error = window.electronAPI.screenRecorder.onRecordingError((data) => {
        console.error('❌ Recording error event:', data);
        if (isComponentMounted.current) {
          setRecordingState(prev => ({
            ...prev,
            isRecording: false,
            isPaused: false,
            duration: 0,
            startTime: null,
            error: data.error || 'Recording failed',
            recordingValidated: false
          }));
          
          // Show specific error message with suggestion if available
          let errorMessage = data.error || 'Unknown error';
          if (data.suggestion) {
            errorMessage += '. ' + data.suggestion;
          }
          
          lastToastRef.current = toast.error('❌ Recording failed: ' + errorMessage, {
            duration: 8000
          });
        }
      });
    }

    // Recording progress
    if (window.electronAPI.screenRecorder.onRecordingProgress) {
      eventCleanupRef.current.progress = window.electronAPI.screenRecorder.onRecordingProgress((data) => {
        if (isComponentMounted.current && data.duration) {
          // Update duration from backend if significantly different
          const backendSeconds = Math.floor(data.duration);
          const frontendSeconds = recordingState.duration;
          
          if (Math.abs(backendSeconds - frontendSeconds) > 2) {
            setRecordingState(prev => ({ ...prev, duration: backendSeconds }));
          }
        }
      });
    }

    console.log('✅ Recording event handlers set up');
  };

  const loadRecordingSettings = async () => {
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
  };

  const refreshDevices = async () => {
    try {
      setLoadingDevices(true);
      
      // Get current status which includes available devices
      const status = await window.electronAPI.screenRecorder.getStatus?.() || {};
      const devices = status.availableDevices || { screens: ['1'], audio: ['0'] };  // Changed default screen to '1'
      
      // Format devices for UI
      const formattedDevices = {
        screens: devices.screens?.map((deviceId, index) => ({
          id: deviceId,
          name: `Screen ${parseInt(deviceId) + 1}`,
          type: 'screen'
        })) || [{ id: '1', name: 'Primary Display', type: 'screen' }],
        
        audio: devices.audio?.map((deviceId, index) => ({
          id: deviceId,
          name: `Audio Input ${parseInt(deviceId) + 1}`,
          type: 'input'
        })) || [{ id: '0', name: 'Default Audio', type: 'input' }]
      };

      setAvailableDevices(formattedDevices);

      // Set defaults if not already set
      if (!selectedScreen && formattedDevices.screens.length > 0) {
        setSelectedScreen(formattedDevices.screens[0].id);
      }
      if (!selectedAudioInput && formattedDevices.audio.length > 0) {
        setSelectedAudioInput(formattedDevices.audio[0].id);
      }

      console.log('✅ Devices refreshed:', { 
        screens: formattedDevices.screens.length, 
        audio: formattedDevices.audio.length 
      });
      
    } catch (error) {
      console.error('Failed to refresh devices:', error);
      toast.error('Failed to refresh devices: ' + error.message);
    } finally {
      setLoadingDevices(false);
    }
  };

  const selectRecordingDirectory = async () => {
    try {
      const result = await window.electronAPI.file.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Recording Directory'
      });

      if (!result.canceled && result.filePaths?.length > 0) {
        const directory = result.filePaths[0];
        setRecordingSettings(prev => ({ ...prev, recordingDirectory: directory }));
        
        // Save to settings
        await window.electronAPI?.settings?.set?.('recordingDirectory', directory);
        toast.success('📁 Recording directory updated');
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
      toast.error('Failed to select directory: ' + error.message);
    }
  };

  const saveRecordingSettings = async () => {
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
  };

  const handleStartRecording = async () => {
    if (!window.electronAPI?.screenRecorder?.startRecording) {
      setRecordingState(prev => ({ 
        ...prev, 
        error: 'Screen recording API not available' 
      }));
      toast.error('Screen recording only available in Electron app');
      return;
    }

    // Check current state before starting
    if (recordingState.isRecording) {
      toast.warning('Recording is already in progress');
      return;
    }

    try {
      setRecordingState(prev => ({ ...prev, error: null }));
      console.log('🎬 Starting enhanced screen recording...');

      // Build recording options
      const options = {
        screenId: selectedScreen,
        audioInputId: selectedAudioInput,
        includeMicrophone: recordingSettings.includeMicrophone,
        includeSystemAudio: recordingSettings.includeSystemAudio,
        audioQuality: 'medium',
        videoQuality: 'medium',
        recordingDirectory: recordingSettings.recordingDirectory || undefined
      };

      console.log('Recording options:', options);
      
      // NEW: The backend now validates recording before confirming success
      const result = await window.electronAPI.screenRecorder.startRecording(options);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to start recording');
      }
      
      console.log('✅ Recording started successfully:', result);
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      setRecordingState(prev => ({ 
        ...prev, 
        error: error.message || 'Failed to start recording',
        isRecording: false
      }));
      
      // Dismiss any loading toast
      if (lastToastRef.current) {
        toast.dismiss(lastToastRef.current);
      }
      
      toast.error('Failed to start recording: ' + error.message);
    }
  };

  const handleStopRecording = async () => {
    if (!window.electronAPI?.screenRecorder?.stopRecording) {
      setRecordingState(prev => ({ 
        ...prev, 
        error: 'Screen recording API not available' 
      }));
      return;
    }

    // Check if actually recording
    if (!recordingState.isRecording) {
      toast.warning('No recording in progress');
      return;
    }

    try {
      setRecordingState(prev => ({ ...prev, error: null }));
      console.log('⏹️ Stopping enhanced screen recording...');
      
      const result = await window.electronAPI.screenRecorder.stopRecording();
      
      if (!result.success && !result.wasAlreadyStopped) {
        throw new Error(result.error || 'Failed to stop recording');
      }
      
      console.log('✅ Recording stopped successfully:', result);
      
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      
      // If error is "No recording in progress", just clean up state
      if (error.message?.includes('No recording in progress')) {
        setRecordingState(prev => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          duration: 0,
          startTime: null,
          error: null
        }));
        toast.info('Recording was already stopped');
      } else {
        setRecordingState(prev => ({ 
          ...prev, 
          error: error.message || 'Failed to stop recording' 
        }));
        toast.error('Failed to stop recording: ' + error.message);
      }
    }
  };

  const handlePauseResume = async () => {
    if (!window.electronAPI?.screenRecorder) {
      setRecordingState(prev => ({ 
        ...prev, 
        error: 'Screen recording API not available' 
      }));
      return;
    }

    if (!recordingState.isRecording || !recordingState.recordingValidated) {
      toast.warning('No validated recording in progress');
      return;
    }

    try {
      setRecordingState(prev => ({ ...prev, error: null }));
      
      if (recordingState.isPaused) {
        console.log('▶️ Resuming recording...');
        const result = await window.electronAPI.screenRecorder.resumeRecording();
        if (result.success) {
          setRecordingState(prev => ({ ...prev, isPaused: false }));
          toast.success('▶️ Recording resumed');
        } else {
          throw new Error(result.error || 'Failed to resume');
        }
      } else {
        console.log('⏸️ Pausing recording...');
        const result = await window.electronAPI.screenRecorder.pauseRecording();
        if (result.success) {
          setRecordingState(prev => ({ ...prev, isPaused: true }));
          toast.success('⏸️ Recording paused');
        } else {
          throw new Error(result.error || 'Failed to pause');
        }
      }
    } catch (error) {
      console.error('❌ Failed to pause/resume recording:', error);
      setRecordingState(prev => ({ 
        ...prev, 
        error: error.message || 'Failed to pause/resume recording' 
      }));
      toast.error('Failed to pause/resume: ' + error.message);
    }
  };

  const triggerAutoTranscription = async (fileInfo) => {
    try {
      console.log('🤖 Auto-triggering transcription for:', fileInfo.name);
      
      updateAppState({ selectedFile: fileInfo });
      
      // Emit a custom event to trigger transcription
      const event = new CustomEvent('autoTranscribe', { 
        detail: { file: fileInfo } 
      });
      window.dispatchEvent(event);
      
      toast.info('🤖 Auto-transcription started...');
      
    } catch (error) {
      console.error('Auto-transcription failed:', error);
      toast.error('Auto-transcription failed: ' + error.message);
    }
  };

  // NEW: Format duration as MM:SS instead of progress bar
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const cleanup = () => {
    stopDurationTimer();
    
    // Clean up event handlers
    Object.values(eventCleanupRef.current).forEach(cleanup => {
      if (typeof cleanup === 'function') cleanup();
    });
    eventCleanupRef.current = {};
    
    // Dismiss any active toasts
    if (lastToastRef.current) {
      toast.dismiss(lastToastRef.current);
    }
  };

  // IMPROVED: Better status indicator with validation state
  const renderStatusIndicator = () => {
    if (recordingState.isRecording) {
      if (!recordingState.recordingValidated) {
        return (
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-yellow-600">
              Starting... {formatDuration(recordingState.duration)}
            </span>
          </div>
        );
      }
      
      return (
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-red-600">
            {recordingState.isPaused ? 'Paused' : 'Recording'} - {formatDuration(recordingState.duration)}
          </span>
        </div>
      );
    }
    
    if (recordingState.error) {
      return (
        <div className="flex items-center space-x-2">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-600">Error occurred</span>
        </div>
      );
    }
    
    if (apiStatus === 'available') {
      return (
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm text-green-600">Ready to record</span>
        </div>
      );
    }
    
    if (apiStatus === 'unavailable') {
      return (
        <div className="flex items-center space-x-2">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-600">API not available</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center space-x-2">
        <AlertCircle className="w-4 h-4 text-yellow-500" />
        <span className="text-sm text-yellow-600">Checking...</span>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Video className="w-5 h-5" />
              <span>Enhanced Screen Recording</span>
            </CardTitle>
            <CardDescription>
              Record your screen with enhanced device control and auto-transcription
            </CardDescription>
          </div>
          {renderStatusIndicator()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Error Display */}
        {recordingState.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {recordingState.error}
            </AlertDescription>
          </Alert>
        )}

        {/* Device Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Device Selection</h4>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshDevices}
              disabled={loadingDevices || recordingState.isRecording}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingDevices ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="screen-select">Screen/Display</Label>
              <Select 
                value={selectedScreen} 
                onValueChange={setSelectedScreen}
                disabled={recordingState.isRecording || loadingDevices}
              >
                <SelectTrigger id="screen-select">
                  <SelectValue placeholder="Select screen" />
                </SelectTrigger>
                <SelectContent>
                  {availableDevices.screens.map((screen) => (
                    <SelectItem key={screen.id} value={screen.id}>
                      <div className="flex items-center space-x-2">
                        <Monitor className="w-4 h-4" />
                        <span>{screen.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="audio-select">Audio Input</Label>
              <Select 
                value={selectedAudioInput} 
                onValueChange={setSelectedAudioInput}
                disabled={recordingState.isRecording || loadingDevices || !recordingSettings.includeMicrophone}
              >
                <SelectTrigger id="audio-select">
                  <SelectValue placeholder="Select audio input" />
                </SelectTrigger>
                <SelectContent>
                  {availableDevices.audio.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      <div className="flex items-center space-x-2">
                        <Mic className="w-4 h-4" />
                        <span>{device.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Recording Settings */}
        <div className="space-y-4">
          <h4 className="font-medium">Recording Settings</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="microphone-toggle">Include Microphone</Label>
                <Switch
                  id="microphone-toggle"
                  checked={recordingSettings.includeMicrophone}
                  onCheckedChange={(checked) => 
                    setRecordingSettings(prev => ({ ...prev, includeMicrophone: checked }))
                  }
                  disabled={recordingState.isRecording}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="system-audio-toggle">Include System Audio</Label>
                <Switch
                  id="system-audio-toggle"
                  checked={recordingSettings.includeSystemAudio}
                  onCheckedChange={(checked) => 
                    setRecordingSettings(prev => ({ ...prev, includeSystemAudio: checked }))
                  }
                  disabled={recordingState.isRecording}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-transcribe-toggle">Auto-transcribe after recording</Label>
                <Switch
                  id="auto-transcribe-toggle"
                  checked={recordingSettings.autoTranscribe}
                  onCheckedChange={(checked) => 
                    setRecordingSettings(prev => ({ ...prev, autoTranscribe: checked }))
                  }
                  disabled={recordingState.isRecording}
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label>Recording Directory</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectRecordingDirectory}
                    disabled={recordingState.isRecording}
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Choose
                  </Button>
                  <span className="text-xs text-muted-foreground truncate">
                    {recordingSettings.recordingDirectory || 'Default location'}
                  </span>
                </div>
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={saveRecordingSettings}
                disabled={recordingState.isRecording}
              >
                <Settings className="w-4 h-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Recording Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Recording Controls</h4>
            {recordingState.lastPath && (
              <Badge variant="secondary" className="text-xs">
                Last: {recordingState.lastPath.split('/').pop()}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              className={`flex-1 ${recordingState.isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'}`}
              onClick={recordingState.isRecording ? handleStopRecording : handleStartRecording}
              disabled={apiStatus !== 'available' || loadingDevices}
            >
              {recordingState.isRecording ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 mr-2" />
                  Start Recording
                </>
              )}
            </Button>
            
            {recordingState.isRecording && recordingState.recordingValidated && (
              <Button 
                variant="secondary" 
                onClick={handlePauseResume}
                disabled={apiStatus !== 'available'}
              >
                {recordingState.isPaused ? (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
            )}
          </div>

          {/* NEW: Timer display instead of progress bar */}
          {recordingState.isRecording && (
            <div className="flex items-center justify-center space-x-2 p-4 bg-muted/50 rounded-lg">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div className="text-center">
                <div className="text-2xl font-mono font-bold">
                  {formatDuration(recordingState.duration)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {!recordingState.recordingValidated ? 'Starting...' : 
                   recordingState.isPaused ? 'Paused' : 'Recording...'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Info */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <h5 className="font-medium text-sm mb-2">Current Configuration</h5>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>Screen: {availableDevices.screens.find(s => s.id === selectedScreen)?.name || 'Not selected'}</div>
            <div>Audio: {recordingSettings.includeMicrophone ? 'Enabled' : 'Disabled'}</div>
            <div>System Audio: {recordingSettings.includeSystemAudio ? 'Enabled' : 'Disabled'}</div>
            <div>Auto-transcribe: {recordingSettings.autoTranscribe ? 'Enabled' : 'Disabled'}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}