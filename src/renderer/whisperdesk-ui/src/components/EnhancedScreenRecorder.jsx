// src/renderer/whisperdesk-ui/src/components/EnhancedScreenRecorder.jsx - REFACTORED
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Video, Bug } from 'lucide-react';
import { useAppState } from '@/App';

// Hooks
import { useDeviceManager } from '../hooks/useDeviceManager';
import { useRecordingSettings } from '../hooks/useRecordingSettings';
import { useScreenRecorder } from '../hooks/useScreenRecorder';

// Components
import { StatusIndicator } from './StatusIndicator';
import { DeviceSelection } from './DeviceSelection';
import { RecordingSettings } from './RecordingSettings';
import { RecordingControls } from './RecordingControls';
import { ConfigurationSummary } from './ConfigurationSummary';
import { RecordingDebugPanel } from './RecordingDebugPanel';

export function EnhancedScreenRecorder() {
  const { appState } = useAppState();
  const [showDebug, setShowDebug] = useState(false);
  
  // Custom hooks for state management
  const deviceManager = useDeviceManager();
  const recordingSettings = useRecordingSettings();
  const screenRecorder = useScreenRecorder({ deviceManager, recordingSettings });

  // Initialize everything on mount
  useEffect(() => {
    const initialize = async () => {
      await screenRecorder.initializeRecorder();
      await recordingSettings.loadRecordingSettings();
    };
    
    initialize();
    
    return () => {
      screenRecorder.cleanup();
      deviceManager.cleanup();
    };
  }, []); // Empty dependency array is intentional

  // 🔴 NEW: Keyboard shortcut to toggle debug panel
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setShowDebug(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="space-y-6">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Video className="w-5 h-5" />
                <span>Enhanced Screen Recording</span>
                {showDebug && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDebug(false)}
                  >
                    <Bug className="w-4 h-4 mr-2" />
                    Hide Debug
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                Record your screen with enhanced device control and auto-transcription
                {!showDebug && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (Ctrl+Shift+D for debug)
                  </span>
                )}
              </CardDescription>
            </div>
            <StatusIndicator 
              apiStatus={screenRecorder.apiStatus} 
              localError={screenRecorder.localError} 
            />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          
          {/* Error Display */}
          {screenRecorder.localError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {screenRecorder.localError}
                {screenRecorder.localError.includes('permission') && (
                  <div className="mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        if (window.electronAPI?.shell?.openExternal) {
                          window.electronAPI.shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
                        }
                      }}
                    >
                      Open System Preferences
                    </Button>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Device Selection */}
          <DeviceSelection 
            deviceManager={deviceManager}
            recordingSettings={recordingSettings}
            isRecording={appState.isRecording}
          />

          <Separator />

          {/* Recording Settings */}
          <RecordingSettings 
            recordingSettings={recordingSettings}
            isRecording={appState.isRecording}
          />

          <Separator />

          {/* Recording Controls */}
          <RecordingControls 
            apiStatus={screenRecorder.apiStatus}
            loadingDevices={deviceManager.loadingDevices}
            onStartRecording={screenRecorder.handleStartRecording}
            onStopRecording={screenRecorder.handleStopRecording}
            onPauseResume={screenRecorder.handlePauseResume}
          />

          {/* Configuration Summary */}
          <ConfigurationSummary 
            deviceManager={deviceManager}
            recordingSettings={recordingSettings}
          />
          
        </CardContent>
      </Card>

      {/* 🔴 NEW: Debug Panel */}
      {showDebug && (
        <RecordingDebugPanel
          deviceManager={deviceManager}
          recordingSettings={recordingSettings}
          screenRecorder={screenRecorder}
        />
      )}
    </div>
  );
}