import React, { useEffect } from 'react';
import { Button } from '../ui/button';
import { Square, Video, Play, Pause, Clock } from 'lucide-react';
import { useScreenRecorderContext } from './ScreenRecorderProvider';

// ✅ SIMPLIFIED: Just treat duration as seconds consistently
const formatDuration = (duration) => {
  // Always treat as seconds now that we've fixed the source
  const totalSeconds = Math.floor(duration || 0);
  
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

  // ✅ DEBUG: Monitor progress events
  useEffect(() => {
    if (isRecording) {
      console.log(`🕐 Timer update: ${recordingDuration} seconds, isRecording: ${isRecording}`);
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
        <div className="flex items-center justify-center space-x-2 p-4 bg-muted/50 rounded-lg border">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-foreground">
              {formatDuration(recordingDuration)}
            </div>
            <div className={`text-sm font-medium px-2 py-1 rounded-md ${
              !recordingValidated 
                ? 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30' 
                : isPaused 
                  ? 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30'
                  : 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30 animate-pulse'
            }`}>
              {!recordingValidated ? 'Starting...' : 
               isPaused ? 'Paused' : 'Recording...'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};