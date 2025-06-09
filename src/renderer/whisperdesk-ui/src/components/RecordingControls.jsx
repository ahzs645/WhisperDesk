// src/renderer/whisperdesk-ui/src/components/RecordingControls.jsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Square, Video, Play, Pause, Clock } from 'lucide-react';
import { useAppState } from '@/App';
import { formatDuration } from '../utils/recordingUtils';

export const RecordingControls = ({ 
  apiStatus,
  loadingDevices,
  onStartRecording,
  onStopRecording,
  onPauseResume
}) => {
  const { appState } = useAppState();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Recording Controls</h4>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          className={`flex-1 ${appState.isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'}`}
          onClick={appState.isRecording ? onStopRecording : onStartRecording}
          disabled={apiStatus !== 'available' || loadingDevices}
        >
          {appState.isRecording ? (
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
        
        {appState.isRecording && appState.recordingValidated && (
          <Button 
            variant="secondary" 
            onClick={onPauseResume}
            disabled={apiStatus !== 'available'}
          >
            {appState.isPaused ? (
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

      {/* Timer display */}
      {appState.isRecording && (
        <div className="flex items-center justify-center space-x-2 p-4 bg-muted/50 rounded-lg">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <div className="text-center">
            <div className="text-2xl font-mono font-bold">
              {formatDuration(appState.recordingDuration || 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              {!appState.recordingValidated ? 'Starting...' : 
               appState.isPaused ? 'Paused' : 'Recording...'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};