// src/renderer/whisperdesk-ui/src/components/StatusIndicator.jsx
import React from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useAppState } from '@/App';
import { formatDuration } from '../utils/recordingUtils';

export const StatusIndicator = ({ apiStatus, localError }) => {
  const { appState } = useAppState();

  if (appState.isRecording) {
    if (!appState.recordingValidated) {
      return (
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-yellow-600">
            Starting... {formatDuration(appState.recordingDuration || 0)}
          </span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        <span className="text-sm font-medium text-red-600">
          {appState.isPaused ? 'Paused' : 'Recording'} - {formatDuration(appState.recordingDuration || 0)}
        </span>
      </div>
    );
  }
  
  if (localError) {
    return (
      <div className="flex items-center space-x-2">
        <XCircle className="w-4 h-4 text-red-500" />
        <span className="text-sm text-red-600">Error occurred</span>
      </div>
    );
  }
  
  if (apiStatus === 'available') {
    return (
      <div className="flex items-center space-x-2">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <span className="text-sm text-green-600">Ready to record</span>
      </div>
    );
  }
  
  if (apiStatus === 'unavailable') {
    return (
      <div className="flex items-center space-x-2">
        <XCircle className="w-4 h-4 text-red-500" />
        <span className="text-sm text-red-600">API not available</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center space-x-2">
      <AlertCircle className="w-4 h-4 text-yellow-500" />
      <span className="text-sm text-yellow-600">Checking...</span>
    </div>
  );
};