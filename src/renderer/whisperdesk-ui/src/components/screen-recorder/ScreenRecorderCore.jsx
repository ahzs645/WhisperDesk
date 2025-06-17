import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { AlertCircle, Video } from 'lucide-react';
import { ScreenRecorderDevices } from './ScreenRecorderDevices';
import { ScreenRecorderSettings } from './ScreenRecorderSettings';
import { ScreenRecorderControls } from './ScreenRecorderControls';
import { ScreenRecorderStatus } from './ScreenRecorderStatus';
import { ScreenRecorderDebug } from './ScreenRecorderDebug';
import { useScreenRecorderContext } from './ScreenRecorderProvider';

export const ScreenRecorderCore = () => {
  const {
    apiStatus,
    localError,
    debugMode,
    toggleDebugMode
  } = useScreenRecorderContext();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Video className="w-5 h-5" />
            <div>
              <CardTitle>Screen Recorder</CardTitle>
              <CardDescription>
                Record your screen with enhanced device control and auto-transcription
              </CardDescription>
            </div>
          </div>
          <ScreenRecorderStatus />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        
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

        <Separator />

        {/* Recording Settings */}
        <ScreenRecorderSettings />

        <Separator />

        {/* Recording Controls */}
        <ScreenRecorderControls />

        {/* Debug Panel Toggle */}
        <div className="flex justify-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleDebugMode}
          >
            {debugMode ? 'Hide Debug Panel' : 'Show Debug Panel'}
          </Button>
        </div>

        {/* Debug Panel */}
        {debugMode && (
          <>
            <Separator />
            <ScreenRecorderDebug />
          </>
        )}

      </CardContent>
    </Card>
  );
}; 