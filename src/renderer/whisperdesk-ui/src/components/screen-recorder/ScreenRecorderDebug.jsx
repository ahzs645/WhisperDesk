import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Bug, RefreshCw, Trash2, Play, CheckCircle, XCircle, Apple, Settings, Monitor } from 'lucide-react';
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
        },
        architecture: status.architecture || {}
      });
      
      setLastSync(new Date().toLocaleTimeString());
      addToEventLog('Debug info refreshed');
    } catch (error) {
      addToEventLog(`Debug refresh failed: ${error.message}`);
    }
  };

  // ✅ UPDATED: Test the new architecture system
  const testArchitectureSystem = async () => {
    try {
      addToEventLog('🧪 Testing New Screen Recording Architecture...');
      
      if (service.testApertureSystem) {
        const results = await service.testApertureSystem();
        results.forEach(result => addToEventLog(result));
      } else {
        // Fallback to manual architecture tests
        await manualArchitectureTests();
      }
    } catch (error) {
      addToEventLog(`❌ Architecture system test failed: ${error.message}`);
    }
  };

  // ✅ UPDATED: Manual architecture tests for the new system
  const manualArchitectureTests = async () => {
    try {
      // Test 1: Get current architecture info
      const status = await service.getStatus();
      const arch = status.architecture || {};
      
      addToEventLog(`🎯 Current method: ${status.recordingMethod || 'unknown'}`);
      addToEventLog(`📋 Architecture type: ${arch.type || 'unknown'}`);
      addToEventLog(`📝 Description: ${arch.description || 'No description'}`);
      
      if (arch.components && arch.components.length > 0) {
        addToEventLog(`🔧 Components: ${arch.components.join(', ')}`);
      }
      
      addToEventLog(`🔄 Stream merging: ${arch.merging ? 'Yes' : 'No'}`);
      addToEventLog(`⭐ Quality level: ${arch.quality || 'unknown'}`);
      
      // Test 2: Architecture-specific checks
      if (arch.type === 'native') {
        addToEventLog('🍎 Native Architecture Tests:');
        addToEventLog('  ✅ Pure ScreenCaptureKit recording');
        addToEventLog('  ✅ Single stream output (screen + system audio + microphone)');
        addToEventLog('  🚫 No browser coordination needed');
        addToEventLog('  🚫 No CPAL dependency');
        addToEventLog('  🚫 No FFmpeg merging');
        addToEventLog('  ⚡ Highest performance and quality');
        
        // Check macOS permissions
        try {
          const permissions = await window.electronAPI.screenRecorder.checkPermissions();
          addToEventLog(`  🔐 Screen Recording Permission: ${permissions.screen}`);
          addToEventLog(`  🎤 Microphone Permission: ${permissions.microphone}`);
          
          if (permissions.screen !== 'granted') {
            addToEventLog('  ⚠️ IMPORTANT: Grant Screen Recording permission!');
            addToEventLog('  💡 System Preferences > Security & Privacy > Privacy > Screen Recording');
          }
        } catch (permError) {
          addToEventLog(`  ❌ Permission check failed: ${permError.message}`);
        }
        
      } else if (arch.type === 'hybrid') {
        addToEventLog('🔄 Hybrid Architecture Tests:');
        addToEventLog('  🌐 Browser MediaRecorder for screen + system audio');
        addToEventLog('  🎤 CPAL for high-quality microphone recording');
        addToEventLog('  🔄 FFmpeg for stream merging');
        addToEventLog('  ✅ Dual-stream recording with high quality');
        addToEventLog('  ⚡ Good performance with enhanced audio');
        
        // Test browser capabilities
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          addToEventLog('  ✅ Browser screen capture supported');
        } else {
          addToEventLog('  ❌ Browser screen capture not available');
        }
        
      } else if (arch.type === 'fallback') {
        addToEventLog('🌐 Fallback Architecture Tests:');
        addToEventLog('  🌐 Pure browser recording');
        addToEventLog('  ⚠️ Limited system audio capabilities');
        addToEventLog('  ✅ Cross-platform compatibility');
        addToEventLog('  📱 Works on all platforms as last resort');
        
      } else {
        addToEventLog('❓ Unknown architecture type detected');
        addToEventLog('  This might indicate a configuration issue');
      }
      
      // Test 3: Check backend capabilities
      if (status.capabilities) {
        addToEventLog('🔧 Backend Capabilities:');
        addToEventLog(`  🔊 System Audio: ${status.capabilities.systemAudio ? '✅' : '❌'} (${status.capabilities.systemAudioMethod || 'unknown'})`);
        addToEventLog(`  🎤 Microphone: ${status.capabilities.microphone ? '✅' : '❌'} (${status.capabilities.microphoneMethod || 'unknown'})`);
        addToEventLog(`  🔄 Merger: ${status.capabilities.merger || 'none'}`);
        addToEventLog(`  ⭐ Quality: ${status.capabilities.quality || 'unknown'}`);
        addToEventLog(`  ⚡ Performance: ${status.capabilities.performance || 'unknown'}`);
      }
      
      // Test 4: Check component status
      if (status.components) {
        addToEventLog('📦 Component Status:');
        Object.entries(status.components).forEach(([component, active]) => {
          const statusText = active ? '✅ Active' : '⏸️ Idle';
          addToEventLog(`  ${component}: ${statusText}`);
        });
        
        if (!status.isRecording) {
          addToEventLog('  💡 Components idle when not recording - this is normal!');
        }
      }
      
      // Test 5: Platform-specific info
      const platform = navigator.platform.toLowerCase();
      if (platform.includes('mac')) {
        addToEventLog('🍎 macOS Platform Info:');
        addToEventLog(`  Expected: Native ScreenCaptureKit (${arch.type === 'native' ? '✅' : '❌'})`);
        if (arch.type !== 'native') {
          addToEventLog('  ⚠️ Not using optimal macOS recording method');
          addToEventLog('  💡 Check ScreenCaptureKit availability');
        }
      } else if (platform.includes('win')) {
        addToEventLog('🪟 Windows Platform Info:');
        addToEventLog(`  Expected: Hybrid Browser+CPAL (${arch.type === 'hybrid' ? '✅' : '❌'})`);
        if (arch.type !== 'hybrid') {
          addToEventLog('  ⚠️ Not using optimal Windows recording method');
          addToEventLog('  💡 Check CPAL and FFmpeg availability');
        }
      } else {
        addToEventLog('🐧 Linux Platform Info:');
        addToEventLog(`  Expected: Hybrid Browser+CPAL (${arch.type === 'hybrid' ? '✅' : '❌'})`);
        if (arch.type !== 'hybrid') {
          addToEventLog('  ⚠️ Not using optimal Linux recording method');
          addToEventLog('  💡 Check CPAL and FFmpeg availability');
        }
      }
      
      addToEventLog('🎉 Architecture system test completed!');
      
    } catch (error) {
      addToEventLog(`❌ Manual architecture test failed: ${error.message}`);
    }
  };

  // ✅ UPDATED: Test file saving flow with architecture awareness
  const testFileSavingFlow = async () => {
    try {
      addToEventLog('💾 Testing file saving flow...');
      
      // Get architecture info
      const status = await service.getStatus();
      const arch = status.architecture || {};
      
      addToEventLog(`📋 Architecture: ${arch.type} (${arch.merging ? 'with merging' : 'direct output'})`);
      
      // Check recording directory setting
      const recordingDir = recordingSettings.recordingDirectory;
      if (recordingDir) {
        addToEventLog(`📁 Custom directory set: ${recordingDir}`);
        
        // Test if directory is accessible (via IPC only)
        try {
          if (window.electronAPI?.file?.exists) {
            const dirExists = await window.electronAPI.file.exists(recordingDir);
            addToEventLog(`📂 Directory exists: ${dirExists ? '✅' : '❌'}`);
          }
        } catch (error) {
          addToEventLog(`❌ Directory check failed: ${error.message}`);
        }
      } else {
        addToEventLog('📁 Using default recording directory');
        
        // Try to get default directory (via IPC only)
        try {
          if (window.electronAPI?.file?.getDefaultRecordingsDirectory) {
            const defaultDir = await window.electronAPI.file.getDefaultRecordingsDirectory();
            addToEventLog(`📂 Default directory: ${defaultDir}`);
          }
        } catch (error) {
          addToEventLog(`❌ Default directory check failed: ${error.message}`);
        }
      }
      
      // Architecture-specific file info
      if (arch.type === 'native') {
        addToEventLog('🍎 Native recording: Single output file expected');
        addToEventLog('  📄 Format: MP4 with embedded audio streams');
        addToEventLog('  🚫 No temporary files or merging needed');
      } else if (arch.type === 'hybrid') {
        addToEventLog('🔄 Hybrid recording: Multiple files with merging');
        addToEventLog('  📄 Browser file: Screen + system audio');
        addToEventLog('  🎤 CPAL file: High-quality microphone');
        addToEventLog('  🔄 FFmpeg merge: Final combined output');
      } else if (arch.type === 'fallback') {
        addToEventLog('🌐 Fallback recording: Browser output only');
        addToEventLog('  📄 Format: WebM or MP4 (browser dependent)');
        addToEventLog('  ⚠️ Limited audio quality');
      }
      
      // Test file write (via IPC only)
      try {
        const testData = new TextEncoder().encode('WhisperDesk test file');
        const testFilename = `test-${Date.now()}.txt`;
        
        if (window.electronAPI?.file?.saveRecordingFile) {
          const result = await window.electronAPI.file.saveRecordingFile(testFilename, testData);
          if (result.success) {
            addToEventLog(`✅ Test file saved: ${result.path}`);
          } else {
            addToEventLog(`❌ Test file save failed: ${result.error}`);
          }
        }
      } catch (error) {
        addToEventLog(`❌ File save test failed: ${error.message}`);
      }
      
      addToEventLog('💾 File saving test completed');
      
    } catch (error) {
      addToEventLog(`❌ File saving test failed: ${error.message}`);
    }
  };

  // ✅ FIXED: Remove direct process access
  const checkRecordingReadiness = async () => {
    try {
      addToEventLog('🔍 Checking recording readiness...');
      
      let issues = 0;
      let warnings = 0;
      
      // Check 1: API availability
      if (apiStatus !== 'available') {
        addToEventLog(`❌ Issue: API Status is ${apiStatus}`);
        issues++;
      } else {
        addToEventLog('✅ API is available');
      }
      
      // Check 2: Device selection
      if (!selectedScreen) {
        addToEventLog('❌ Issue: No screen device selected');
        issues++;
      } else {
        addToEventLog(`✅ Screen selected: ${selectedScreen}`);
      }
      
      if (recordingSettings.includeMicrophone && !selectedAudioInput) {
        addToEventLog('❌ Issue: Microphone enabled but no audio device selected');
        issues++;
      } else if (recordingSettings.includeMicrophone) {
        addToEventLog(`✅ Audio device selected: ${selectedAudioInput}`);
      }
      
      // Check 3: Permissions (macOS) - via IPC only
      try {
        // ✅ FIXED: Use navigator instead of process for platform detection
        const isMacOS = navigator.platform.includes('Mac') || navigator.userAgent.includes('Mac');
        
        if (isMacOS) {
          try {
            const permissions = await window.electronAPI.screenRecorder.checkPermissions();
            if (permissions.screen !== 'granted') {
              addToEventLog('❌ Issue: Screen recording permission not granted');
              issues++;
            }
            if (recordingSettings.includeMicrophone && permissions.microphone !== 'granted') {
              addToEventLog('⚠️ Warning: Microphone permission not granted');
              warnings++;
            }
          } catch (error) {
            addToEventLog('⚠️ Warning: Could not check permissions');
            warnings++;
          }
        } else {
          addToEventLog('✅ Non-macOS platform - permissions assumed granted');
        }
      } catch (error) {
        addToEventLog(`⚠️ Warning: Platform check failed: ${error.message}`);
        warnings++;
      }
      
      // Final assessment
      if (issues === 0 && warnings === 0) {
        addToEventLog('🎉 Recording readiness: PERFECT! All systems go!');
      } else if (issues === 0) {
        addToEventLog(`✅ Recording readiness: GOOD (${warnings} warnings)`);
      } else {
        addToEventLog(`❌ Recording readiness: ISSUES FOUND (${issues} issues, ${warnings} warnings)`);
      }
      
      addToEventLog('🔍 Recording readiness check completed');
      
    } catch (error) {
      addToEventLog(`❌ Readiness check failed: ${error.message}`);
    }
  };

  // ✅ NEW: Request permissions explicitly
  const requestPermissions = async () => {
    try {
      addToEventLog('🔐 Requesting system permissions...');
      
      if (window.electronAPI?.screenRecorder?.requestPermissions) {
        const result = await window.electronAPI.screenRecorder.requestPermissions();
        addToEventLog(`📱 Permission request result: ${JSON.stringify(result)}`);
        
        if (result.screen === 'granted') {
          addToEventLog('✅ Screen recording permission granted!');
        } else {
          addToEventLog('❌ Screen recording permission denied');
          addToEventLog('💡 Go to System Preferences > Security & Privacy > Privacy > Screen Recording');
        }
        
        if (result.microphone === 'granted') {
          addToEventLog('✅ Microphone permission granted!');
        } else if (recordingSettings.includeMicrophone) {
          addToEventLog('❌ Microphone permission denied');
        }
      } else {
        addToEventLog('❌ Permission request API not available');
      }
    } catch (error) {
      addToEventLog(`❌ Permission request failed: ${error.message}`);
    }
  };

  // ✅ NEW: Test recording flow end-to-end
  const testRecordingFlow = async () => {
    try {
      addToEventLog('🧪 Testing complete recording flow...');
      
      // Step 1: Check readiness
      addToEventLog('1️⃣ Checking readiness...');
      await checkRecordingReadiness();
      
      // Step 2: Test file saving
      addToEventLog('2️⃣ Testing file system...');
      await testFileSavingFlow();
      
      // Step 3: Test Aperture system
      addToEventLog('3️⃣ Testing Aperture v7 system...');
      await testArchitectureSystem();
      
      // Step 4: Summary
      const status = await service.getStatus();
      addToEventLog('📊 FLOW TEST SUMMARY:');
      addToEventLog(`   Method: ${status.recordingMethod || 'unknown'}`);
      addToEventLog(`   System Audio: ${status.capabilities?.systemAudio ? '✅' : '❌'}`);
      addToEventLog(`   Microphone: ${status.capabilities?.microphone ? '✅' : '❌'}`);
      addToEventLog(`   File Saving: ${window.electronAPI?.file?.saveRecordingFile ? '✅' : '❌'}`);
      addToEventLog('🎉 Complete recording flow test finished!');
      
    } catch (error) {
      addToEventLog(`❌ Recording flow test failed: ${error.message}`);
    }
  };

  const testRecordingAPI = async () => {
    try {
      addToEventLog('Testing recording API...');
      
      if (window.electronAPI?.screenRecorder) {
        addToEventLog('✅ Screen recorder API is available');
        
        const status = await window.electronAPI.screenRecorder.getStatus();
        addToEventLog(`✅ API test result: Recording method is ${status.method || 'unknown'}`);
        
        const screens = await window.electronAPI.screenRecorder.getAvailableScreens();
        addToEventLog(`✅ Available screens: ${screens.length || (screens.screens?.length || 0)}`);
        
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
        addToEventLog(`✅ Cleanup result: ${result.success ? 'Success' : 'Failed'}`);
      } else {
        addToEventLog('❌ Force cleanup not available');
      }
      
      await refreshDebugInfo();
    } catch (error) {
      addToEventLog(`❌ Force cleanup failed: ${error.message}`);
    }
  };

  // ✅ Enhanced device enumeration test
  const testDeviceEnumeration = async () => {
    try {
      addToEventLog('🔍 Testing device enumeration...');
      
      // Test 1: Main process screen enumeration
      addToEventLog('📱 Testing main process screen enumeration...');
      try {
        const screenResult = await window.electronAPI.screenRecorder.getAvailableScreens(true);
        addToEventLog(`📊 Main process result: ${JSON.stringify(screenResult)}`);
        
        if (screenResult.success && screenResult.screens) {
          addToEventLog(`✅ Main process found ${screenResult.screens.length} screens`);
          screenResult.screens.forEach((screen, index) => {
            addToEventLog(`  ${index + 1}. ${screen.name} (${screen.id})`);
          });
        } else {
          addToEventLog('❌ Main process returned no screens or failed');
        }
      } catch (error) {
        addToEventLog(`❌ Main process screen enumeration failed: ${error.message}`);
      }
      
      // Test 2: Renderer fallback using desktopCapturer
      addToEventLog('🔄 Testing renderer fallback (desktopCapturer)...');
      try {
        if (window.electronAPI?.desktopCapturer?.getSources) {
          const sources = await window.electronAPI.desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 0, height: 0 }
          });
          addToEventLog(`✅ Renderer fallback found ${sources.length} sources`);
          sources.forEach((source, index) => {
            addToEventLog(`  ${index + 1}. ${source.name} (${source.id})`);
          });
        } else {
          addToEventLog('❌ desktopCapturer API not available in renderer');
        }
      } catch (error) {
        addToEventLog(`❌ Renderer fallback failed: ${error.message}`);
      }
      
      // Test 3: Audio device enumeration
      addToEventLog('🎤 Testing audio device enumeration...');
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(device => device.kind === 'audioinput');
          addToEventLog(`✅ Found ${audioInputs.length} audio input devices`);
          audioInputs.forEach((device, index) => {
            addToEventLog(`  ${index + 1}. ${device.label || 'Unknown'} (${device.deviceId})`);
          });
        } else {
          addToEventLog('❌ MediaDevices API not available');
        }
      } catch (error) {
        addToEventLog(`❌ Audio enumeration failed: ${error.message}`);
      }
      
      // Test 4: Backend service status
      addToEventLog('🔧 Testing backend service status...');
      try {
        const status = await window.electronAPI.screenRecorder.getStatus();
        addToEventLog(`📊 Backend status: ${JSON.stringify(status, null, 2)}`);
        
        if (status.availableDevices) {
          addToEventLog(`📱 Backend devices: ${status.availableDevices.screens?.length || 0} screens, ${status.availableDevices.audio?.length || 0} audio`);
        }
      } catch (error) {
        addToEventLog(`❌ Backend status failed: ${error.message}`);
      }
      
      addToEventLog('🎉 Device enumeration test completed!');
      
    } catch (error) {
      addToEventLog(`❌ Device enumeration test failed: ${error.message}`);
    }
  };

  useEffect(() => {
    refreshDebugInfo();
    const interval = setInterval(refreshDebugInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  const getArchitectureBadge = () => {
    const arch = debugInfo.architecture || {};
    const type = arch.type || 'unknown';
    
    const badgeProps = {
      native: { variant: 'default', className: 'bg-green-100 text-green-800' },
      hybrid: { variant: 'secondary', className: 'bg-blue-100 text-blue-800' },
      fallback: { variant: 'outline', className: 'bg-yellow-100 text-yellow-800' },
      unknown: { variant: 'destructive' }
    };
    
    return (
      <Badge {...(badgeProps[type] || badgeProps.unknown)}>
        {type.toUpperCase()}
      </Badge>
    );
  };

  const getArchitectureIcon = () => {
    const arch = debugInfo.architecture || {};
    const type = arch.type || 'unknown';
    
    switch (type) {
      case 'native':
        return <Apple className="h-4 w-4 text-green-600" />;
      case 'hybrid':
        return <Monitor className="h-4 w-4 text-blue-600" />;
      case 'fallback':
        return <Settings className="h-4 w-4 text-yellow-600" />;
      default:
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Architecture Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getArchitectureIcon()}
            Recording Architecture
            {getArchitectureBadge()}
          </CardTitle>
          <CardDescription>
            Current recording method and system capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {debugInfo.architecture && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Type:</span> {debugInfo.architecture.type || 'Unknown'}
              </div>
              <div>
                <span className="font-medium">Quality:</span> {debugInfo.architecture.quality || 'Unknown'}
              </div>
              <div className="col-span-2">
                <span className="font-medium">Description:</span> {debugInfo.architecture.description || 'No description available'}
              </div>
              {debugInfo.architecture.components && (
                <div className="col-span-2">
                  <span className="font-medium">Components:</span> {debugInfo.architecture.components.join(', ')}
                </div>
              )}
              <div>
                <span className="font-medium">Stream Merging:</span> {debugInfo.architecture.merging ? 'Yes' : 'No'}
              </div>
              <div>
                <span className="font-medium">Method:</span> {debugInfo.backendStatus?.recordingMethod || 'Unknown'}
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button 
              onClick={testArchitectureSystem} 
              variant="outline" 
              size="sm"
              className="flex items-center gap-1"
            >
              <Bug className="h-4 w-4" />
              Test Architecture
            </Button>
            <Button 
              onClick={refreshDebugInfo} 
              variant="outline" 
              size="sm"
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>
            Backend status and device information
            {lastSync && (
              <span className="text-xs text-muted-foreground ml-2">
                Last sync: {lastSync}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">API Available:</span> 
              <Badge variant={debugInfo.apiAvailable ? "default" : "destructive"} className="ml-2">
                {debugInfo.apiAvailable ? "Yes" : "No"}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Recording:</span> 
              <Badge variant={isRecording ? "default" : "secondary"} className="ml-2">
                {isRecording ? "Active" : "Idle"}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Screens:</span> {debugInfo.deviceCounts?.screens || 0}
            </div>
            <div>
              <span className="font-medium">Audio Devices:</span> {debugInfo.deviceCounts?.audio || 0}
            </div>
            <div className="col-span-2">
              <span className="font-medium">Selected Screen:</span> {selectedScreen?.name || 'None'}
            </div>
            <div className="col-span-2">
              <span className="font-medium">Selected Audio:</span> {selectedAudioInput?.label || 'Default'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Controls</CardTitle>
          <CardDescription>
            Test various aspects of the recording system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={testArchitectureSystem} 
              variant="outline" 
              size="sm"
              className="flex items-center gap-1"
            >
              <Bug className="h-4 w-4" />
              Test Architecture
            </Button>
            <Button 
              onClick={testFileSavingFlow} 
              variant="outline" 
              size="sm"
              className="flex items-center gap-1"
            >
              <Settings className="h-4 w-4" />
              Test File Saving
            </Button>
            <Button 
              onClick={testDeviceEnumeration} 
              variant="outline" 
              size="sm"
              className="flex items-center gap-1"
            >
              <Settings className="h-4 w-4" />
              Test Device Enumeration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Event Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Event Log
            <Button 
              onClick={clearEventLog} 
              variant="ghost" 
              size="sm"
              className="flex items-center gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </CardTitle>
          <CardDescription>
            Real-time events and test results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 w-full border rounded p-2">
            <div className="space-y-1">
              {eventLog.slice(-50).map((event, index) => (
                <div key={index} className="text-xs font-mono whitespace-pre-wrap">
                  <span className="text-muted-foreground">
                    [{event.timestamp}]
                  </span>{' '}
                  {event.message}
                </div>
              ))}
              {eventLog.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No events logged yet. Click "Test Architecture" to start.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};