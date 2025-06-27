import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { AlertCircle, Video, Zap } from 'lucide-react';
import { ScreenRecorderDevices } from './ScreenRecorderDevices';
import { ScreenRecorderControls } from './ScreenRecorderControls';
import { ScreenRecorderStatus } from './ScreenRecorderStatus';
import { useScreenRecorderContext } from './ScreenRecorderProvider';

export const ScreenRecorderCore = () => {
  const {
    apiStatus,
    localError,
    recordingSettings
  } = useScreenRecorderContext();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Video className="w-5 h-5" />
            <div>
              <CardTitle className="flex items-center space-x-2">
                <span>Screen Recorder</span>
                {recordingSettings.autoTranscribe && (
                  <Badge variant="outline" className="ml-2">
                    <Zap className="w-3 h-3 mr-1" />
                    Auto-transcribe
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Record your screen with audio and automatically transcribe
              </CardDescription>
            </div>
          </div>
          <ScreenRecorderStatus />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        
        {/* Error Display */}
        {localError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {localError}
              {localError.includes('permission') && (
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

        {/* API Status Warning */}
        {apiStatus !== 'available' && (
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Screen recorder API is {apiStatus}. Some features may not work properly.
            </AlertDescription>
          </Alert>
        )}

        {/* Device Selection */}
        <ScreenRecorderDevices />

        {/* Recording Controls */}
        <ScreenRecorderControls />

      </CardContent>
    </Card>
  );
}; 