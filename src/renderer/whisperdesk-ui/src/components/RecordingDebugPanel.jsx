// src/renderer/whisperdesk-ui/src/components/RecordingDebugPanel.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Bug, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useAppState } from '@/App';

export const RecordingDebugPanel = ({ deviceManager, recordingSettings, screenRecorder }) => {
  const { appState } = useAppState();
  const [debugInfo, setDebugInfo] = useState({});
  const [eventLog, setEventLog] = useState([]);
  const [lastSync, setLastSync] = useState(null);

  const addToEventLog = (event) => {
    const timestamp = new Date().toLocaleTimeString();
    setEventLog(prev => [{
      timestamp,
      event,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // 🔴 FIXED: Unique ID with random suffix
    }, ...prev.slice(0, 9)]); // Keep last 10 events
  };

  // Monitor screen recorder events
  useEffect(() => {
    if (!window.electronAPI?.screenRecorder) return;

    const cleanupFunctions = [];

    // Set up event monitoring
    const events = [
      { name: 'started', handler: (data) => addToEventLog(`Recording started: ${JSON.stringify(data)}`) },
      { name: 'validated', handler: (data) => addToEventLog(`Recording validated: ${JSON.stringify(data)}`) },
      { name: 'completed', handler: (data) => addToEventLog(`Recording completed: ${JSON.stringify(data)}`) },
      { name: 'error', handler: (data) => addToEventLog(`Recording error: ${JSON.stringify(data)}`) },
      { name: 'progress', handler: (data) => addToEventLog(`Recording progress: ${data.duration}ms`) },
      { name: 'paused', handler: (data) => addToEventLog(`Recording paused: ${JSON.stringify(data)}`) },
      { name: 'resumed', handler: (data) => addToEventLog(`Recording resumed: ${JSON.stringify(data)}`) }
    ];

    events.forEach(({ name, handler }) => {
      const eventName = `onRecording${name.charAt(0).toUpperCase() + name.slice(1)}`;
      if (window.electronAPI.screenRecorder[eventName]) {
        const cleanup = window.electronAPI.screenRecorder[eventName](handler);
        if (cleanup) cleanupFunctions.push(cleanup);
      }
    });

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, []);

  const refreshDebugInfo = async () => {
    try {
      const status = await window.electronAPI.screenRecorder.getStatus();
      const availableScreens = await window.electronAPI.screenRecorder.getAvailableScreens();
      
      setDebugInfo({
        backendStatus: status,
        availableScreens,
        apiAvailable: !!window.electronAPI?.screenRecorder,
        timestamp: new Date().toLocaleTimeString()
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
      
      // 🔴 FIXED: Use the correct debug function name
      if (window.electronAPI?.debug?.test) {
        const result = await window.electronAPI.debug.test();
        addToEventLog(`API test result: ${JSON.stringify(result)}`);
      } else if (window.electronAPI?.debug?.testIPC) {
        const result = await window.electronAPI.debug.testIPC();
        addToEventLog(`IPC test result: ${JSON.stringify(result)}`);
      } else {
        addToEventLog('No debug.test function available - checking other APIs...');
        
        // Test screen recorder status instead
        const status = await window.electronAPI.screenRecorder.getStatus();
        addToEventLog(`Screen recorder status: ${JSON.stringify(status)}`);
      }
    } catch (error) {
      addToEventLog(`API test failed: ${error.message}`);
    }
  };

  const forceCleanup = async () => {
    try {
      addToEventLog('Force cleanup requested...');
      const result = await window.electronAPI.screenRecorder.forceCleanup();
      addToEventLog(`Cleanup result: ${JSON.stringify(result)}`);
      await refreshDebugInfo();
    } catch (error) {
      addToEventLog(`Force cleanup failed: ${error.message}`);
    }
  };

  const validateDevices = async () => {
    try {
      addToEventLog('Validating device selections...');
      const result = await deviceManager.validateAndFixDeviceSelections();
      
      if (result.valid) {
        addToEventLog('✅ All device selections are valid');
      } else {
        addToEventLog(`❌ Found invalid device selections: ${result.issues.join(', ')}`);
        if (result.changed) {
          addToEventLog('✅ Fixed invalid device selections automatically');
        }
      }
      
      await refreshDebugInfo();
    } catch (error) {
      addToEventLog(`Device validation failed: ${error.message}`);
    }
  };

  const analyzeRecordingError = async () => {
    try {
      addToEventLog('Running comprehensive error analysis...');
      
      const status = await window.electronAPI.screenRecorder.getStatus();
      const availableScreens = await window.electronAPI.screenRecorder.getAvailableScreens();
      
      let issues = [];
      
      // Check basic API availability
      if (!window.electronAPI?.screenRecorder) {
        issues.push('Screen Recorder API not available');
      }
      
      // Check device selection
      if (!deviceManager.selectedScreen) {
        issues.push('No screen device selected');
      } else if (!deviceManager.availableDevices.screens.find(s => s.id === deviceManager.selectedScreen)) {
        issues.push(`Selected screen device '${deviceManager.selectedScreen}' not found in available devices`);
      }
      
      // Check audio configuration
      if (recordingSettings.recordingSettings.includeMicrophone && !deviceManager.selectedAudioInput) {
        issues.push('Microphone enabled but no audio device selected');
      }
      
      // Check permissions (if error indicates permission issue)
      if (status.lastError && status.lastError.includes('permission')) {
        issues.push('Screen recording permission likely denied');
      }
      
      // Check backend state
      if (status.hasActiveProcess && !status.isRecording) {
        issues.push('Stale recording process detected');
      }
      
      if (issues.length === 0) {
        addToEventLog('✅ No obvious configuration issues found');
      } else {
        issues.forEach((issue, index) => {
          addToEventLog(`❌ Issue ${index + 1}: ${issue}`);
        });
      }
      
      // Add suggestions
      addToEventLog('💡 Suggestions:');
      addToEventLog('1. Check screen recording permissions in System Preferences');
      addToEventLog('2. Try refreshing devices and selecting different screen');
      addToEventLog('3. Temporarily disable microphone recording to test');
      addToEventLog('4. Run Force Cleanup if issues persist');
      
    } catch (error) {
      addToEventLog(`Error analysis failed: ${error.message}`);
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
          <span>Recording Debug Panel</span>
          <Badge variant="outline">{lastSync ? `Last sync: ${lastSync}` : 'Not synced'}</Badge>
        </CardTitle>
        <CardDescription>
          Debug information for screen recording functionality
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        
        {/* Control Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={refreshDebugInfo}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={testRecordingAPI}>
            Test API
          </Button>
          <Button variant="outline" size="sm" onClick={forceCleanup}>
            Force Cleanup
          </Button>
          <Button variant="outline" size="sm" onClick={validateDevices}>
            Validate Devices
          </Button>
          <Button variant="outline" size="sm" onClick={analyzeRecordingError}>
            Analyze Error
          </Button>
          {/* 🔴 Permission check button for macOS */}
          {window.platform?.isMacOS && (
            <Button variant="outline" size="sm" onClick={() => {
              if (window.electronAPI?.shell?.openExternal) {
                window.electronAPI.shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
                addToEventLog('Opened System Preferences for screen recording permissions');
              }
            }}>
              Check Permissions
            </Button>
          )}
        </div>

        <Separator />

        {/* Frontend State */}
        <div>
          <h4 className="font-medium mb-2">Frontend State</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Recording: <Badge variant={appState.isRecording ? "destructive" : "secondary"}>
              {appState.isRecording ? 'YES' : 'NO'}
            </Badge></div>
            <div>Validated: <Badge variant={appState.recordingValidated ? "default" : "secondary"}>
              {appState.recordingValidated ? 'YES' : 'NO'}
            </Badge></div>
            <div>Paused: <Badge variant={appState.isPaused ? "default" : "secondary"}>
              {appState.isPaused ? 'YES' : 'NO'}
            </Badge></div>
            <div>Duration: {appState.recordingDuration || 0}s</div>
          </div>
        </div>

        {/* Device State */}
        <div>
          <h4 className="font-medium mb-2">Device State</h4>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div>Selected Screen: <code>{deviceManager.selectedScreen || 'None'}</code></div>
            <div>Selected Audio: <code>{deviceManager.selectedAudioInput || 'None'}</code></div>
            <div>Available Screens: {deviceManager.availableDevices.screens.length}</div>
            <div>Available Audio: {deviceManager.availableDevices.audio.length}</div>
            <div>Devices Initialized: <Badge variant={deviceManager.devicesInitialized ? "default" : "secondary"}>
              {deviceManager.devicesInitialized ? 'YES' : 'NO'}
            </Badge></div>
          </div>
        </div>

        {/* Backend State */}
        {debugInfo.backendStatus && (
          <div>
            <h4 className="font-medium mb-2">Backend State</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Recording: <Badge variant={debugInfo.backendStatus.isRecording ? "destructive" : "secondary"}>
                {debugInfo.backendStatus.isRecording ? 'YES' : 'NO'}
              </Badge></div>
              <div>Validated: <Badge variant={debugInfo.backendStatus.recordingValidated ? "default" : "secondary"}>
                {debugInfo.backendStatus.recordingValidated ? 'YES' : 'NO'}
              </Badge></div>
              <div>Has Process: <Badge variant={debugInfo.backendStatus.hasActiveProcess ? "default" : "secondary"}>
                {debugInfo.backendStatus.hasActiveProcess ? 'YES' : 'NO'}
              </Badge></div>
              <div className="col-span-2">
                Last Error: <code className="text-red-500 text-xs">
                  {debugInfo.backendStatus.lastError || 'None'}
                </code>
              </div>
            </div>
            
            {/* 🔴 NEW: Recording failure analysis */}
            {debugInfo.backendStatus.lastError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
                <div className="font-medium text-red-700 mb-1">Error Analysis:</div>
                <div className="text-red-600">
                  {debugInfo.backendStatus.lastError.includes('permission') && (
                    <div>→ Permission issue: Check screen recording permissions</div>
                  )}
                  {debugInfo.backendStatus.lastError.includes('code null') && (
                    <div>→ Process crash: FFmpeg likely failed to start or crashed immediately</div>
                  )}
                  {debugInfo.backendStatus.lastError.includes('device') && (
                    <div>→ Device issue: Try selecting different screen/audio devices</div>
                  )}
                  {debugInfo.backendStatus.lastError.includes('Input/output error') && (
                    <div>→ I/O Error: Check device access and permissions</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* API Status */}
        <div>
          <h4 className="font-medium mb-2">API Status</h4>
          <div className="flex items-center space-x-2">
            {debugInfo.apiAvailable ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Screen Recorder API Available</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-red-500" />
                <span>Screen Recorder API Not Available</span>
              </>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Error: {screenRecorder.localError || 'None'}
          </div>
        </div>

        <Separator />

        {/* Event Log */}
        <div>
          <h4 className="font-medium mb-2">Event Log</h4>
          <div className="max-h-48 overflow-y-auto border rounded p-2 bg-muted/50">
            {eventLog.length === 0 ? (
              <div className="text-sm text-muted-foreground">No events yet...</div>
            ) : (
              eventLog.map((entry) => (
                <div key={entry.id} className="text-xs mb-1">
                  <span className="text-muted-foreground">{entry.timestamp}</span>
                  <span className="ml-2">{entry.event}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Device Details */}
        {debugInfo.backendStatus?.availableDevices && (
          <div>
            <h4 className="font-medium mb-2">Available Devices (Backend)</h4>
            <div className="text-sm space-y-1">
              <div>Screens: {JSON.stringify(debugInfo.backendStatus.availableDevices.screens)}</div>
              <div>Audio: {JSON.stringify(debugInfo.backendStatus.availableDevices.audio)}</div>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
};