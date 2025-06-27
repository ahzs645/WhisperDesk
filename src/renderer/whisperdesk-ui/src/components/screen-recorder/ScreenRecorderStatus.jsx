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
        badgeClassName: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
        iconClassName: 'text-red-600 dark:text-red-400'
      };
    }

    if (apiStatus !== 'available') {
      return {
        variant: 'outline',
        icon: AlertTriangle,
        text: 'API Unavailable',
        badgeClassName: 'bg-yellow-50 text-yellow-800 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700',
        iconClassName: 'text-yellow-600 dark:text-yellow-400'
      };
    }

    if (isRecording) {
      if (!recordingValidated) {
        return {
          variant: 'outline',
          icon: Clock,
          text: 'Starting...',
          badgeClassName: 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700',
          iconClassName: 'text-blue-600 dark:text-blue-400'
        };
      }
      
      if (isPaused) {
        return {
          variant: 'outline',
          icon: Circle,
          text: 'Paused',
          badgeClassName: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700',
          iconClassName: 'text-amber-600 dark:text-amber-400'
        };
      }

      return {
        variant: 'outline',
        icon: Circle,
        text: 'Recording',
        badgeClassName: 'bg-red-50 text-red-800 border-red-300 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700 animate-pulse',
        iconClassName: 'text-red-600 dark:text-red-400 animate-pulse'
      };
    }

    return {
      variant: 'outline',
      icon: CheckCircle,
      text: 'Ready',
      badgeClassName: 'bg-green-50 text-green-800 border-green-300 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700',
      iconClassName: 'text-green-600 dark:text-green-400'
    };
  };

  const status = getStatusInfo();
  const Icon = status.icon;

  return (
    <Badge variant={status.variant} className={`flex items-center space-x-1 ${status.badgeClassName}`}>
      <Icon className={`w-3 h-3 ${status.iconClassName}`} />
      <span className="font-medium">{status.text}</span>
    </Badge>
  );
}; 