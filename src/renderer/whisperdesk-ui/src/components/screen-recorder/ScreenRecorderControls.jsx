import React from 'react';
import { Button } from '../ui/button';
import { Square, Video, Play, Pause, Clock } from 'lucide-react';
import { useScreenRecorderContext } from './ScreenRecorderProvider';

// Format duration utility that handles both seconds and milliseconds
const formatDuration = (duration) => {
  // If duration is a very small number (0-59), it's likely in seconds
  // If duration is a larger number (1000+), it's likely in milliseconds
  let totalSeconds;
  
  if (duration < 60) {
    // Likely in seconds already
    totalSeconds = Math.floor(duration);
  } else {
    // Likely in milliseconds, convert to seconds
    totalSeconds = Math.floor(duration / 1000);
  }
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
};

export const ScreenRecorderControls = () => {
  const {
    isRecording,
    isPaused,
    recordingDuration,
    recordingValidated,
    apiStatus,
    loadingDevices,
    startRecording,
    stopRecording,
    pauseResume
  } = useScreenRecorderContext();

  // Debug log to see what duration value we're getting
  React.useEffect(() => {
    if (isRecording && recordingDuration !== undefined) {
      console.log('🕐 Duration received:', recordingDuration, 'type:', typeof recordingDuration);
    }
  }, [recordingDuration, isRecording]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Recording Controls</h4>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          className={`flex-1 ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={apiStatus !== 'available' || loadingDevices}
        >
          {isRecording ? (
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
        
        {isRecording && recordingValidated && (
          <Button 
            variant="secondary" 
            onClick={pauseResume}
            disabled={apiStatus !== 'available'}
          >
            {isPaused ? (
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
      {isRecording && (
        <div className="flex items-center justify-center space-x-2 p-4 bg-muted/50 rounded-lg">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <div className="text-center">
            <div className="text-2xl font-mono font-bold">
              {formatDuration(recordingDuration || 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              {!recordingValidated ? 'Starting...' : 
               isPaused ? 'Paused' : 'Recording...'}
            </div>
            {/* Debug info */}
            <div className="text-xs text-muted-foreground mt-1">
              Raw: {recordingDuration} {typeof recordingDuration === 'number' && recordingDuration > 60 ? '(ms)' : '(s)'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};