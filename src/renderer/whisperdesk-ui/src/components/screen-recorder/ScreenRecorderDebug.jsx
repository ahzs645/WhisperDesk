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