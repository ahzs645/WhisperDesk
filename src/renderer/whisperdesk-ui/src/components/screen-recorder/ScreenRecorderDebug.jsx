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

  const testSystemAudioCapture = async () => {
    console.log('🧪 Testing system audio capture methods...');
    addToEventLog('🧪 Testing system audio capture methods...');
    
    const methods = [
      {
        name: 'Method 1: Desktop audio via chromeMediaSource',
        test: async () => {
          const constraints = {
            video: false,
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop',
                autoGainControl: false,
                echoCancellation: false,
                noiseSuppression: false,
                sampleRate: 48000
              }
            }
          };
          return await navigator.mediaDevices.getUserMedia(constraints);
        }
      },
      {
        name: 'Method 2: getDisplayMedia with audio',
        test: async () => {
          return await navigator.mediaDevices.getDisplayMedia({
            video: false,
            audio: {
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
              sampleRate: 48000
            }
          });
        }
      },
      {
        name: 'Method 3: Combined video+audio getDisplayMedia',
        test: async () => {
          return await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
        }
      },
      {
        name: 'Method 4: Desktop capture with audio',
        test: async () => {
          const constraints = {
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: selectedScreen
              }
            },
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: selectedScreen
              }
            }
          };
          return await navigator.mediaDevices.getUserMedia(constraints);
        }
      }
    ];

    let successfulMethods = [];

    for (const method of methods) {
      try {
        console.log(`🧪 Testing: ${method.name}`);
        addToEventLog(`🧪 Testing: ${method.name}`);
        
        const stream = await method.test();
        
        const result = {
          audioTracks: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioSettings: stream.getAudioTracks()[0]?.getSettings(),
          audioLabel: stream.getAudioTracks()[0]?.label
        };
        
        console.log(`✅ ${method.name} SUCCESS:`, result);
        addToEventLog(`✅ ${method.name} SUCCESS: ${result.audioTracks} audio tracks, ${result.videoTracks} video tracks`);
        
        if (result.audioTracks > 0) {
          successfulMethods.push(method.name);
          addToEventLog(`🎉 ${method.name} can capture system audio! Label: ${result.audioLabel}`);
          
          // Test if we can actually record from this stream
          try {
            const testRecorder = new MediaRecorder(stream);
            console.log(`✅ ${method.name} is compatible with MediaRecorder`);
            addToEventLog(`✅ ${method.name} is compatible with MediaRecorder`);
          } catch (recorderError) {
            console.log(`❌ ${method.name} NOT compatible with MediaRecorder:`, recorderError.message);
            addToEventLog(`❌ ${method.name} NOT compatible with MediaRecorder: ${recorderError.message}`);
          }
        } else {
          addToEventLog(`⚠️ ${method.name} succeeded but captured no audio tracks`);
        }
        
        // Clean up test stream
        stream.getTracks().forEach(track => track.stop());
        
      } catch (error) {
        console.log(`❌ ${method.name} FAILED:`, error.message);
        addToEventLog(`❌ ${method.name} FAILED: ${error.message}`);
        
        // Provide specific error guidance
        if (error.name === 'NotAllowedError') {
          addToEventLog(`💡 ${method.name}: Permission denied - user may need to allow screen sharing with audio`);
        } else if (error.name === 'NotSupportedError') {
          addToEventLog(`💡 ${method.name}: Not supported on this platform/browser`);
        } else if (error.name === 'NotFoundError') {
          addToEventLog(`💡 ${method.name}: No system audio source found`);
        }
      }
    }

    // Summary
    if (successfulMethods.length > 0) {
      console.log('🎉 SYSTEM AUDIO CAPTURE SUMMARY:', successfulMethods);
      addToEventLog(`🎉 SUMMARY: ${successfulMethods.length} methods can capture system audio:`);
      successfulMethods.forEach(method => addToEventLog(`  ✅ ${method}`));
      addToEventLog('💡 Your recordings should now include system audio!');
    } else {
      console.log('❌ NO METHODS can capture system audio');
      addToEventLog('❌ NO METHODS can capture system audio');
      addToEventLog('💡 System audio may not be available on this platform');
      addToEventLog('💡 Try: 1) Ensure apps are playing audio 2) Check browser permissions 3) Try different screen sources');
    }

    // Platform-specific advice
    const platform = navigator.platform;
    if (platform.includes('Mac')) {
      addToEventLog('🍎 macOS: You may need to grant "Screen Recording" permission in System Preferences > Security & Privacy');
    } else if (platform.includes('Win')) {
      addToEventLog('🪟 Windows: System audio capture should work with getDisplayMedia');
    } else if (platform.includes('Linux')) {
      addToEventLog('🐧 Linux: System audio capture support varies by browser and desktop environment');
    }
  };

  const testSafeSystemAudio = async () => {
    console.log('🛡️ Testing SAFE system audio methods only...');
    addToEventLog('🛡️ Starting SAFE system audio test (no crashes)...');
    
    // Platform info
    addToEventLog(`🖥️ Platform: ${navigator.platform}`);
    addToEventLog(`🌐 Browser: ${navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other'}`);
    addToEventLog(`⚡ Electron: ${navigator.userAgent.includes('Electron') ? 'Yes' : 'No'}`);
    
    // Only test methods that are guaranteed safe
    const safeMethods = [
      {
        name: 'getDisplayMedia with video+audio (SAFE)',
        description: 'Standard safe method for system audio',
        test: async () => {
          return await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
        }
      },
      {
        name: 'getDisplayMedia with detailed audio settings (SAFE)',
        description: 'Safe method with specific audio constraints',
        test: async () => {
          return await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'always' },
            audio: {
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
              sampleRate: 48000,
              channelCount: 2
            }
          });
        }
      }
    ];

    let workingMethods = 0;
    const results = [];
    
    for (const method of safeMethods) {
      addToEventLog(`🧪 Testing: ${method.name}`);
      console.log(`🧪 Testing: ${method.name} - ${method.description}`);
      
      try {
        const stream = await method.test();
        
        const audioTracks = stream.getAudioTracks().length;
        const videoTracks = stream.getVideoTracks().length;
        
        if (audioTracks > 0) {
          workingMethods++;
          const audioTrack = stream.getAudioTracks()[0];
          const settings = audioTrack.getSettings();
          
          addToEventLog(`✅ ${method.name} SUCCESS!`);
          addToEventLog(`  📊 Audio: ${audioTracks} tracks, Video: ${videoTracks} tracks`);
          addToEventLog(`  🎵 Settings: ${settings.sampleRate || 'Unknown'}Hz, ${settings.channelCount || 'Unknown'}ch`);
          addToEventLog(`  🏷️ Label: ${audioTrack.label || 'No label'}`);
          
          // Test MediaRecorder compatibility
          try {
            const testRecorder = new MediaRecorder(stream);
            addToEventLog(`  ✅ MediaRecorder compatible`);
            console.log(`✅ ${method.name} is MediaRecorder compatible`);
            
            // Test actual recording for 2 seconds
            addToEventLog(`  🎬 Testing 2-second recording...`);
            const chunks = [];
            
            testRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunks.push(e.data);
            };
            
            testRecorder.onstop = () => {
              const blob = new Blob(chunks, { type: 'video/webm' });
              addToEventLog(`  ✅ Test recording: ${blob.size} bytes`);
              console.log(`✅ ${method.name} test recording: ${blob.size} bytes`);
            };
            
            testRecorder.start();
            setTimeout(() => {
              if (testRecorder.state === 'recording') {
                testRecorder.stop();
              }
            }, 2000);
            
          } catch (recorderError) {
            addToEventLog(`  ❌ MediaRecorder NOT compatible: ${recorderError.message}`);
            console.log(`❌ ${method.name} NOT compatible:`, recorderError.message);
          }
          
        } else {
          addToEventLog(`⚠️ ${method.name} succeeded but no audio tracks`);
          addToEventLog(`  📊 Video: ${videoTracks} tracks, Audio: ${audioTracks} tracks`);
        }
        
        // Clean up test stream
        stream.getTracks().forEach(track => track.stop());
        
        results.push({
          name: method.name,
          success: true,
          audioTracks,
          videoTracks
        });
        
      } catch (error) {
        addToEventLog(`❌ ${method.name} FAILED: ${error.message}`);
        console.log(`❌ ${method.name} FAILED:`, error.message);
        
        // Provide specific guidance
        if (error.name === 'NotAllowedError') {
          addToEventLog(`💡 Permission denied - user cancelled or needs system permission`);
        } else if (error.name === 'NotSupportedError' || error.message.includes('Not supported')) {
          addToEventLog(`💡 System audio not supported in this environment`);
        } else if (error.message.includes('video must be requested')) {
          addToEventLog(`💡 Audio-only capture not allowed, need video+audio`);
        } else {
          addToEventLog(`💡 Unexpected error - check browser/system compatibility`);
        }
        
        results.push({
          name: method.name,
          success: false,
          error: error.message
        });
      }
    }

    // Test summary
    addToEventLog('');
    addToEventLog(`🎉 SAFE TEST SUMMARY:`);
    addToEventLog(`✅ Working methods: ${workingMethods}/${safeMethods.length}`);
    
    if (workingMethods > 0) {
      addToEventLog('🎊 System audio capture IS possible on your system!');
      addToEventLog('💡 Your recordings should include system audio');
      
      const working = results.filter(r => r.success && r.audioTracks > 0);
      working.forEach(result => {
        addToEventLog(`  ✅ ${result.name} (${result.audioTracks} audio)`);
      });
    } else {
      addToEventLog('❌ System audio capture is not available');
      addToEventLog('');
      addToEventLog('🔧 TROUBLESHOOTING:');
      addToEventLog('1. 🍎 macOS: System Preferences > Security & Privacy > Screen Recording');
      addToEventLog('   - Add your browser/app and enable it');
      addToEventLog('   - Restart the app after granting permission');
      addToEventLog('2. 🔊 Test with audio actively playing');
      addToEventLog('   - Play music/video in another app during test');
      addToEventLog('3. 🌐 Try different browsers');
      addToEventLog('   - Chrome usually has the best support');
      addToEventLog('4. 🎵 Consider audio routing software');
      addToEventLog('   - BlackHole (free): brew install blackhole-2ch');
      addToEventLog('   - SoundFlower (alternative)');
      addToEventLog('5. 📱 Check Electron version');
      addToEventLog('   - Newer versions have better audio support');
    }
    
    // macOS-specific advice
    if (navigator.platform.includes('Mac')) {
      addToEventLog('');
      addToEventLog('🍎 macOS SPECIFIC TIPS:');
      addToEventLog('• System audio needs "Screen Recording" permission');
      addToEventLog('• Some apps may need "Accessibility" permission too');
      addToEventLog('• BlackHole is the most reliable solution for system audio');
      addToEventLog('• Try recording from different apps (Music, Safari, etc.)');
    }
    
    console.log('🛡️ Safe system audio test completed - no crashes!');
    addToEventLog('🛡️ Safe test completed successfully (no crashes)');
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
          <Button variant="outline" size="sm" onClick={testSystemAudioCapture}>
            <Play className="w-4 h-4 mr-2" />
            Test System Audio Capture
          </Button>
          <Button variant="outline" size="sm" onClick={testSafeSystemAudio}>
            <Play className="w-4 h-4 mr-2" />
            Test System Audio (SAFE)
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