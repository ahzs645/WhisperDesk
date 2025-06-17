import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Bug, RefreshCw, Trash2, Play, CheckCircle, XCircle } from 'lucide-react';
import { useScreenRecorderContext } from './ScreenRecorderProvider';

export const ScreenRecorderDebug = () => {
  const {
    eventLog,
    service,
    availableDevices,
    selectedScreen,
    selectedAudioInput,
    recordingSettings,
    apiStatus,
    isRecording,
    addToEventLog,
    clearEventLog
  } = useScreenRecorderContext();

  const [debugInfo, setDebugInfo] = useState({});
  const [lastSync, setLastSync] = useState(null);

  const refreshDebugInfo = async () => {
    try {
      // Use the service's getStatus method (which calls IPC)
      const status = await service.getStatus();
      
      setDebugInfo({
        backendStatus: status,
        apiAvailable: !!window.electronAPI?.screenRecorder,
        timestamp: new Date().toLocaleTimeString(),
        deviceCounts: {
          screens: availableDevices.screens.length,
          audio: availableDevices.audio.length
        },
        selections: {
          screen: selectedScreen,
          audio: selectedAudioInput
        }
      });
      
      setLastSync(new Date().toLocaleTimeString());
      addToEventLog('Debug info refreshed');
    } catch (error) {
      addToEventLog(`Debug refresh failed: ${error.message}`);
    }
  };

  const testRecordingAPI = async () => {
    try {
      addToEventLog('Testing recording API...');
      
      // Test if the API is available
      if (window.electronAPI?.screenRecorder) {
        addToEventLog('✅ Screen recorder API is available');
        
        // Test getting status
        const status = await window.electronAPI.screenRecorder.getStatus();
        addToEventLog(`✅ API test result: ${JSON.stringify(status)}`);
        
        // Test getting screens
        const screens = await window.electronAPI.screenRecorder.getAvailableScreens();
        addToEventLog(`✅ Available screens: ${screens.length}`);
        
      } else {
        addToEventLog('❌ Screen recorder API is not available');
      }
    } catch (error) {
      addToEventLog(`❌ API test failed: ${error.message}`);
    }
  };

  const forceCleanup = async () => {
    try {
      addToEventLog('Force cleanup requested...');
      
      if (window.electronAPI?.screenRecorder?.forceCleanup) {
        const result = await window.electronAPI.screenRecorder.forceCleanup();
        addToEventLog(`✅ Cleanup result: ${JSON.stringify(result)}`);
      } else {
        addToEventLog('❌ Force cleanup not available');
      }
      
      await refreshDebugInfo();
    } catch (error) {
      addToEventLog(`❌ Force cleanup failed: ${error.message}`);
    }
  };

  const analyzeConfiguration = () => {
    addToEventLog('Analyzing configuration...');
    
    let issues = [];
    
    // Check API availability
    if (apiStatus !== 'available') {
      issues.push(`API Status: ${apiStatus}`);
    }
    
    // Check device selection
    if (!selectedScreen) {
      issues.push('No screen device selected');
    }
    
    if (recordingSettings.includeMicrophone && !selectedAudioInput) {
      issues.push('Microphone enabled but no audio device selected');
    }
    
    // Check device availability
    if (availableDevices.screens.length === 0) {
      issues.push('No screen devices available');
    }
    
    if (recordingSettings.includeMicrophone && availableDevices.audio.length === 0) {
      issues.push('No audio devices available');
    }
    
    // Check file permissions
    if (recordingSettings.recordingDirectory) {
      addToEventLog(`Recording directory: ${recordingSettings.recordingDirectory}`);
    } else {
      addToEventLog('Using default recording directory');
    }
    
    if (issues.length === 0) {
      addToEventLog('✅ Configuration looks good');
    } else {
      issues.forEach((issue, index) => {
        addToEventLog(`❌ Issue ${index + 1}: ${issue}`);
      });
    }
  };

  const testFileSystem = async () => {
    try {
      addToEventLog('Testing file system access...');
      
      if (window.electronAPI?.file) {
        addToEventLog('✅ File API is available');
        
        // Test if we can access file dialog
        if (window.electronAPI.file.showSaveDialog) {
          addToEventLog('✅ Save dialog available');
        }
        
        if (window.electronAPI.file.showOpenDialog) {
          addToEventLog('✅ Open dialog available');
        }
      } else {
        addToEventLog('❌ File API not available');
      }
      
      // Test recording directory
      if (recordingSettings.recordingDirectory) {
        addToEventLog(`📁 Custom recording directory: ${recordingSettings.recordingDirectory}`);
      } else {
        addToEventLog('📁 Using default recording directory');
      }
      
    } catch (error) {
      addToEventLog(`❌ File system test failed: ${error.message}`);
    }
  };

  const testElectronAPIs = async () => {
    console.log('🧪 Testing Electron APIs...');
    addToEventLog('🧪 Starting comprehensive API tests...');
    
    // Test 1: Check if APIs exist
    console.log('1. Checking API availability...');
    console.log('electronAPI exists:', !!window.electronAPI);
    console.log('file API exists:', !!window.electronAPI?.file);
    console.log('screenRecorder API exists:', !!window.electronAPI?.screenRecorder);
    
    addToEventLog(`electronAPI exists: ${!!window.electronAPI}`);
    addToEventLog(`file API exists: ${!!window.electronAPI?.file}`);
    addToEventLog(`screenRecorder API exists: ${!!window.electronAPI?.screenRecorder}`);
    
    if (window.electronAPI?.file) {
      const fileMethods = Object.keys(window.electronAPI.file);
      console.log('Available file methods:', fileMethods);
      addToEventLog(`Available file methods: ${fileMethods.join(', ')}`);
    }
    
    // Test 2: Test screen recorder status
    if (window.electronAPI?.screenRecorder?.getStatus) {
      try {
        const status = await window.electronAPI.screenRecorder.getStatus();
        console.log('2. Screen recorder status test:', status);
        addToEventLog(`✅ Screen recorder status: ${JSON.stringify(status)}`);
      } catch (error) {
        console.error('2. Screen recorder status test FAILED:', error);
        addToEventLog(`❌ Screen recorder status test FAILED: ${error.message}`);
      }
    }
    
    // Test 3: Test file write (with small test data)
    if (window.electronAPI?.file?.writeFile) {
      try {
        const testData = new TextEncoder().encode('test file content');
        const testPath = 'test-recording.txt';
        
        await window.electronAPI.file.writeFile(testPath, testData);
        console.log('3. File write test: SUCCESS');
        addToEventLog('✅ File write test: SUCCESS');
        
        // Test if file exists
        if (window.electronAPI.file.exists) {
          const exists = await window.electronAPI.file.exists(testPath);
          console.log('3. File exists test:', exists);
          addToEventLog(`File exists test: ${exists}`);
        }
      } catch (error) {
        console.error('3. File write test FAILED:', error);
        addToEventLog(`❌ File write test FAILED: ${error.message}`);
      }
    }
    
    // Test 4: Test save dialog availability
    if (window.electronAPI?.file?.showSaveDialog) {
      console.log('4. Save dialog API: Available');
      addToEventLog('✅ Save dialog API: Available');
    } else {
      console.log('4. Save dialog API: NOT Available');
      addToEventLog('❌ Save dialog API: NOT Available');
    }
    
    console.log('🧪 API tests completed');
    addToEventLog('🧪 API tests completed');
  };

  const testSaveRecordingAPI = async () => {
    console.log('🧪 Testing saveRecordingFile API specifically...');
    addToEventLog('🧪 Testing saveRecordingFile API specifically...');
    
    try {
      // Create a small test video blob
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 100, 100);
      
      // Create a small test recording
      const stream = canvas.captureStream();
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      
      recorder.ondataavailable = (e) => chunks.push(e.data);
      
      console.log('📹 Started test recording...');
      addToEventLog('📹 Started test recording...');
      recorder.start();
      
      // Record for 1 second
      setTimeout(async () => {
        recorder.stop();
        
        recorder.onstop = async () => {
          try {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            console.log(`📦 Created test blob: ${blob.size} bytes`);
            addToEventLog(`📦 Created test blob: ${blob.size} bytes`);
            
            // Test saveRecordingFile with correct parameters
            if (window.electronAPI?.file?.saveRecordingFile) {
              const testPath = `test-recording-${Date.now()}.webm`;
              
              console.log('📋 Calling saveRecordingFile with path:', testPath, ', dataLength:', uint8Array.length);
              addToEventLog(`📋 Calling saveRecordingFile with path: ${testPath}, dataLength: ${uint8Array.length}`);
              
              // Call with correct parameter order: filePath, data
              const result = await window.electronAPI.file.saveRecordingFile(testPath, uint8Array);
              console.log('✅ saveRecordingFile test result:', JSON.stringify(result));
              addToEventLog(`✅ saveRecordingFile test result: ${JSON.stringify(result)}`);
              
              if (result && result.success) {
                console.log('🎉 File save test PASSED! File saved to:', result.path);
                addToEventLog(`🎉 File save test PASSED! File saved to: ${result.path}`);
                
                // Only test file existence if the exists API is available and doesn't cause errors
                try {
                  if (window.electronAPI.file.exists) {
                    const exists = await window.electronAPI.file.exists(result.path);
                    console.log('✅ File exists verification:', exists);
                    addToEventLog(`✅ File exists verification: ${exists}`);
                  }
                } catch (existsError) {
                  console.warn('⚠️ File existence check failed (but save was successful):', existsError.message);
                  addToEventLog(`⚠️ File existence check failed (but save was successful): ${existsError.message}`);
                }
              } else {
                console.error('❌ File save test FAILED:', result?.error);
                addToEventLog(`❌ File save test FAILED: ${result?.error}`);
              }
            } else {
              console.log('❌ saveRecordingFile not available');
              addToEventLog('❌ saveRecordingFile not available');
            }
            
            // Test default directory
            try {
              if (window.electronAPI?.file?.getDefaultRecordingsDirectory) {
                const defaultDir = await window.electronAPI.file.getDefaultRecordingsDirectory();
                console.log('📁 Default recordings directory:', defaultDir);
                addToEventLog(`📁 Default recordings directory: ${defaultDir}`);
              }
            } catch (dirError) {
              console.warn('⚠️ Could not get default directory:', dirError.message);
              addToEventLog(`⚠️ Could not get default directory: ${dirError.message}`);
            }
            
          } catch (error) {
            console.error('❌ saveRecordingFile test failed:', error.message);
            addToEventLog(`❌ saveRecordingFile test failed: ${error.message}`);
          }
        };
      }, 1000);
      
    } catch (error) {
      console.error('❌ Test setup failed:', error);
      addToEventLog(`❌ Test setup failed: ${error.message}`);
    }
  };

  const testAudioRecording = async () => {
    console.log('🧪 Testing audio recording specifically...');
    addToEventLog('🧪 Testing audio recording specifically...');
    
    try {
      // Test microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          deviceId: selectedAudioInput === 'default' ? undefined : { exact: selectedAudioInput },
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true
        }, 
        video: false 
      });
      
      console.log('✅ Audio stream obtained:', stream.getAudioTracks());
      addToEventLog(`✅ Audio stream obtained with ${stream.getAudioTracks().length} audio tracks`);
      
      // Test that we can record from it
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        console.log('✅ Audio recording test successful:', audioBlob.size, 'bytes');
        addToEventLog(`✅ Audio recording test successful: ${audioBlob.size} bytes`);
        
        // Create a URL to test playback
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        addToEventLog('🔊 Test audio created - check browser console for playback URL');
        console.log('🔊 Test audio playback URL:', audioUrl);
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Record for 2 seconds
      recorder.start();
      setTimeout(() => recorder.stop(), 2000);
      
      addToEventLog('🎤 Recording 2 seconds of audio for test...');
      
    } catch (error) {
      console.error('❌ Audio test failed:', error);
      addToEventLog(`❌ Audio test failed: ${error.message}`);
      
      if (error.name === 'NotAllowedError') {
        addToEventLog('❌ Microphone permission denied - check browser permissions');
      } else if (error.name === 'NotFoundError') {
        addToEventLog('❌ Audio device not found - check device selection');
      }
    }
  };

  const debugRecordingOptions = async () => {
    console.log('🔍 Debugging recording options flow...');
    addToEventLog('🔍 Debugging recording options flow...');
    
    try {
      // 1. Check the current state
      console.log('📋 Current state:', {
        selectedScreen,
        selectedAudioInput,
        recordingSettings,
        availableDevices
      });
      
      addToEventLog(`📋 Selected screen: ${selectedScreen}`);
      addToEventLog(`📋 Selected audio: ${selectedAudioInput}`);
      addToEventLog(`📋 Include microphone: ${recordingSettings.includeMicrophone}`);
      addToEventLog(`📋 Include system audio: ${recordingSettings.includeSystemAudio}`);
      
      // 2. Build the options object exactly like startRecording does
      const recordingOptions = {
        screenId: selectedScreen,
        audioInputId: selectedAudioInput,
        ...recordingSettings
      };
      
      console.log('🎯 Recording options that would be sent:', recordingOptions);
      addToEventLog(`🎯 Recording options: ${JSON.stringify(recordingOptions, null, 2)}`);
      
      // 3. Check if the audio device exists
      const audioDevice = availableDevices.audio.find(device => device.id === selectedAudioInput);
      if (audioDevice) {
        console.log('✅ Audio device found:', audioDevice);
        addToEventLog(`✅ Audio device found: ${audioDevice.name}`);
      } else {
        console.log('❌ Audio device NOT found');
        addToEventLog(`❌ Audio device NOT found for ID: ${selectedAudioInput}`);
      }
      
      // 4. Test what the service's cleanOptionsForIPC would do
      const allowedKeys = [
        'screenId',
        'audioInputId', 
        'includeMicrophone',
        'includeSystemAudio',
        'videoQuality',
        'audioQuality',
        'recordingDirectory',
        'filename'
      ];
      
      const cleanOptions = {};
      allowedKeys.forEach(key => {
        if (recordingOptions[key] !== undefined && recordingOptions[key] !== null) {
          try {
            JSON.stringify(recordingOptions[key]);
            cleanOptions[key] = recordingOptions[key];
          } catch (error) {
            console.warn(`Skipping non-serializable option ${key}:`, error);
          }
        }
      });
      
      console.log('🧹 Clean options for IPC:', cleanOptions);
      addToEventLog(`🧹 Clean options: ${JSON.stringify(cleanOptions, null, 2)}`);
      
      // 5. Check validation
      if (!cleanOptions.screenId) {
        addToEventLog('❌ ISSUE: No screenId in clean options');
      }
      
      if (cleanOptions.includeMicrophone && !cleanOptions.audioInputId) {
        addToEventLog('❌ ISSUE: Microphone enabled but no audioInputId');
      }
      
      if (!cleanOptions.includeMicrophone) {
        addToEventLog('⚠️ NOTE: Microphone is disabled in settings');
      }
      
      // 6. Test the actual getUserMedia call that would be made
      if (cleanOptions.includeMicrophone && cleanOptions.audioInputId) {
        try {
          console.log('🧪 Testing getUserMedia with exact options...');
          const audioConstraints = {
            deviceId: cleanOptions.audioInputId === 'default' ? undefined : { exact: cleanOptions.audioInputId },
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
            sampleSize: 16,
            channelCount: 2
          };
          
          console.log('🎤 Audio constraints:', audioConstraints);
          addToEventLog(`🎤 Audio constraints: ${JSON.stringify(audioConstraints)}`);
          
          const testStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: audioConstraints
          });
          
          console.log('✅ getUserMedia test successful:', testStream.getAudioTracks());
          addToEventLog(`✅ getUserMedia test successful: ${testStream.getAudioTracks().length} tracks`);
          
          // Cleanup
          testStream.getTracks().forEach(track => track.stop());
          
        } catch (error) {
          console.error('❌ getUserMedia test failed:', error);
          addToEventLog(`❌ getUserMedia test failed: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Debug failed:', error);
      addToEventLog(`❌ Debug failed: ${error.message}`);
    }
  };

  useEffect(() => {
    refreshDebugInfo();
    const interval = setInterval(refreshDebugInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Bug className="w-5 h-5" />
          <span>Debug Panel</span>
          <Badge variant="outline">{lastSync ? `Last sync: ${lastSync}` : 'Not synced'}</Badge>
        </CardTitle>
        <CardDescription>
          Debug information for screen recording functionality
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        
        {/* Debug Actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={refreshDebugInfo}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={testRecordingAPI}>
            <Play className="w-4 h-4 mr-2" />
            Test API
          </Button>
          <Button variant="outline" size="sm" onClick={testElectronAPIs}>
            <Play className="w-4 h-4 mr-2" />
            Test APIs
          </Button>
          <Button variant="outline" size="sm" onClick={testSaveRecordingAPI}>
            <Play className="w-4 h-4 mr-2" />
            Test Save Recording API
          </Button>
          <Button variant="outline" size="sm" onClick={testAudioRecording}>
            <Play className="w-4 h-4 mr-2" />
            Test Audio Recording
          </Button>
          <Button variant="outline" size="sm" onClick={debugRecordingOptions}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Debug Recording Options
          </Button>
          <Button variant="outline" size="sm" onClick={analyzeConfiguration}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Analyze Config
          </Button>
          <Button variant="outline" size="sm" onClick={testFileSystem}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Test File System
          </Button>
          <Button variant="outline" size="sm" onClick={forceCleanup} disabled={isRecording}>
            <XCircle className="w-4 h-4 mr-2" />
            Force Cleanup
          </Button>
          <Button variant="outline" size="sm" onClick={clearEventLog}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Log
          </Button>
        </div>

        <Separator />

        {/* Status Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="font-medium">API Status</div>
            <Badge variant={apiStatus === 'available' ? 'default' : 'secondary'}>
              {apiStatus}
            </Badge>
          </div>
          <div>
            <div className="font-medium">Recording</div>
            <Badge variant={isRecording ? 'destructive' : 'secondary'}>
              {isRecording ? 'Active' : 'Idle'}
            </Badge>
          </div>
          <div>
            <div className="font-medium">Devices</div>
            <div className="text-muted-foreground">
              {debugInfo.deviceCounts?.screens || 0} screens, {debugInfo.deviceCounts?.audio || 0} audio
            </div>
          </div>
          <div>
            <div className="font-medium">Selections</div>
            <div className="text-muted-foreground">
              {selectedScreen ? '✅' : '❌'} Screen, {selectedAudioInput ? '✅' : '❌'} Audio
            </div>
          </div>
        </div>

        <Separator />

        {/* Configuration Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium mb-2">Current Settings</div>
            <div className="space-y-1 text-muted-foreground">
              <div>Microphone: {recordingSettings.includeMicrophone ? '✅' : '❌'}</div>
              <div>System Audio: {recordingSettings.includeSystemAudio ? '✅' : '❌'}</div>
              <div>Video Quality: {recordingSettings.videoQuality}</div>
              <div>Audio Quality: {recordingSettings.audioQuality}</div>
              <div>Auto Transcribe: {recordingSettings.autoTranscribe ? '✅' : '❌'}</div>
            </div>
          </div>
          <div>
            <div className="font-medium mb-2">Device Selection</div>
            <div className="space-y-1 text-muted-foreground">
              <div>Screen ID: {selectedScreen || 'None'}</div>
              <div>Audio ID: {selectedAudioInput || 'None'}</div>
              <div className="truncate">Recording Dir: {recordingSettings.recordingDirectory || 'Default'}</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Event Log */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium">Event Log</h4>
            <Badge variant="outline">{eventLog.length} events</Badge>
          </div>
          
          <ScrollArea className="h-48 w-full border rounded-md p-2">
            {eventLog.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                No events logged yet
              </div>
            ) : (
              <div className="space-y-1">
                {eventLog.map((log, index) => (
                  <div key={index} className="text-xs font-mono">
                    <span className="text-muted-foreground">[{log.timestamp}]</span> {log.event}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Debug Info */}
        {debugInfo.backendStatus && (
          <div>
            <h4 className="font-medium mb-2">Backend Status</h4>
            <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto">
              {JSON.stringify(debugInfo.backendStatus, null, 2)}
            </pre>
          </div>
        )}

      </CardContent>
    </Card>
  );
};