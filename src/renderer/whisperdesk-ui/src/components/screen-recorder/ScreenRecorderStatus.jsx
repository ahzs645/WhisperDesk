import React from 'react';
import { Badge } from '../ui/badge';
import { Circle, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useScreenRecorderContext } from './ScreenRecorderProvider';

export const ScreenRecorderStatus = () => {
  const {
    isRecording,
    isPaused,
    recordingValidated,
    apiStatus,
    localError
  } = useScreenRecorderContext();

  const getStatusInfo = () => {
    if (localError) {
      return {
        variant: 'destructive',
        icon: AlertTriangle,
        text: 'Error',
        className: 'text-red-500'
      };
    }

    if (apiStatus !== 'available') {
      return {
        variant: 'secondary',
        icon: AlertTriangle,
        text: 'API Unavailable',
        className: 'text-yellow-500'
      };
    }

    if (isRecording) {
      if (!recordingValidated) {
        return {
          variant: 'secondary',
          icon: Clock,
          text: 'Starting...',
          className: 'text-blue-500'
        };
      }
      
      if (isPaused) {
        return {
          variant: 'secondary',
          icon: Circle,
          text: 'Paused',
          className: 'text-yellow-500'
        };
      }

      return {
        variant: 'destructive',
        icon: Circle,
        text: 'Recording',
        className: 'text-red-500 animate-pulse'
      };
    }

    return {
      variant: 'secondary',
      icon: CheckCircle,
      text: 'Ready',
      className: 'text-green-500'
    };
  };

  const status = getStatusInfo();
  const Icon = status.icon;

  return (
    <Badge variant={status.variant} className="flex items-center space-x-1">
      <Icon className={`w-3 h-3 ${status.className}`} />
      <span>{status.text}</span>
    </Badge>
  );
}; 