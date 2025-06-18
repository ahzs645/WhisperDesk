import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Bug, RefreshCw, Trash2, Play, CheckCircle, XCircle, Apple, Settings } from 'lucide-react';
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

  // ✅ FIXED: Test Aperture v7 system specifically (renderer-safe)
  const testApertureSystem = async () => {
    try {
      addToEventLog('🍎 Testing Aperture v7 Screen Recording System...');
      
      if (service.testApertureSystem) {
        const results = await service.testApertureSystem();
        results.forEach(result => addToEventLog(result));
      } else {
        // Fallback to manual Aperture tests (renderer-safe version)
        await manualApertureTestsRendererSafe();
      }
    } catch (error) {
      addToEventLog(`❌ Aperture system test failed: ${error.message}`);
    }
  };

  // ✅ FIXED: Renderer-safe version of manual Aperture tests
  const manualApertureTestsRendererSafe = async () => {
    try {
      // Test 1: Check current recording method
      const status = await service.getStatus();
      addToEventLog(`🎯 Current method: ${status.recordingMethod || 'unknown'}`);
      
      if (status.recordingMethod?.includes('aperture')) {
        addToEventLog('✅ Aperture v7 system is active!');
        
        // Test 2: Check capabilities
        if (status.capabilities) {
          addToEventLog(`🔊 System Audio: ${status.capabilities.systemAudio ? '✅ Native ScreenCaptureKit' : '❌'}`);
          addToEventLog(`🎤 Microphone: ${status.capabilities.microphone ? '✅ CPAL Enhanced' : '❌'}`);
          addToEventLog(`⚡ Performance: ${status.capabilities.performance || 'unknown'}`);
          addToEventLog(`⭐ Quality: ${status.capabilities.quality || 'unknown'}`);
        }
        
        // Test 3: Check macOS permissions (via IPC only)
        try {
          const permissions = await window.electronAPI.screenRecorder.checkPermissions();
          addToEventLog(`🔐 Screen Recording Permission: ${permissions.screen}`);
          addToEventLog(`🎤 Microphone Permission: ${permissions.microphone}`);
          
          if (permissions.screen !== 'granted') {
            addToEventLog('⚠️ IMPORTANT: Grant Screen Recording permission in System Preferences');
            addToEventLog('   📱 Go to: System Preferences > Security & Privacy > Privacy > Screen Recording');
          }
        } catch (permError) {
          addToEventLog(`❌ Permission check failed: ${permError.message}`);
        }
        
        // Test 4: Check backend components status
        if (status.components) {
          addToEventLog('🔧 Backend Components Status:');
          Object.entries(status.components).forEach(([component, active]) => {
            const statusText = active ? '✅ Active' : '⏸️ Idle (normal when not recording)';
            addToEventLog(`   ${component}: ${statusText}`);
          });
          
          // Explain component states
          if (!status.isRecording) {
            addToEventLog('💡 Components are idle when not recording - this is normal!');
          }
        }
        
        // Test 5: Check file paths
        if (status.outputPaths && Object.keys(status.outputPaths).length > 0) {
          addToEventLog('📁 Recording Paths:');
          Object.entries(status.outputPaths).forEach(([type, path]) => {
            addToEventLog(`   ${type}: ${path}`);
          });
        } else {
          addToEventLog('📁 No active recording paths (normal when not recording)');
        }
        
        if (status.finalOutputPath) {
          addToEventLog(`🎯 Final Output: ${status.finalOutputPath}`);
        }
        
      } else {
        addToEventLog('❌ Aperture v7 system not active');
        addToEventLog(`   Current method: ${status.recordingMethod}`);
        addToEventLog('💡 This means you\'re using browser-based recording');
      }
      
      addToEventLog('🎉 Aperture v7 system test completed!');
      
    } catch (error) {
      addToEventLog(`❌ Manual Aperture test failed: ${error.message}`);
    }
  };

  // ✅ FIXED: Remove all Node.js module usage
  const testFileSavingFlow = async () => {
    try {
      addToEventLog('💾 Testing file saving flow...');
      
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
      await testApertureSystem();
      
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
        
        {/* Enhanced Debug Actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={refreshDebugInfo}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          
          {/* ✅ Main tests */}
          <Button variant="outline" size="sm" onClick={testApertureSystem}>
            <Apple className="w-4 h-4 mr-2" />
            Test Aperture v7
          </Button>
          
          <Button variant="outline" size="sm" onClick={checkRecordingReadiness}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Check Readiness
          </Button>
          
          <Button variant="outline" size="sm" onClick={testRecordingFlow}>
            <Play className="w-4 h-4 mr-2" />
            Test Full Flow
          </Button>
          
          {/* ✅ Secondary tests */}
          <Button variant="outline" size="sm" onClick={testFileSavingFlow}>
            <Play className="w-4 h-4 mr-2" />
            Test File Saving
          </Button>
          
          <Button variant="outline" size="sm" onClick={testRecordingAPI}>
            <Play className="w-4 h-4 mr-2" />
            Test API
          </Button>
          
          {/* ✅ System actions */}
          <Button variant="outline" size="sm" onClick={requestPermissions}>
            <Settings className="w-4 h-4 mr-2" />
            Request Permissions
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

        {/* Enhanced Configuration Details */}
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
              <div>Method: {debugInfo.backendStatus?.recordingMethod || 'Unknown'}</div>
              <div>Platform: {navigator.platform}</div>
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

        {/* Enhanced Debug Info */}
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