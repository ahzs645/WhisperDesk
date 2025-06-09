// src/renderer/whisperdesk-ui/src/utils/recordingUtils.js

/**
 * Format duration in seconds to MM:SS format
 */
export const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Create a hash string from device arrays for comparison
 */
export const createDeviceHash = (devices) => {
  return JSON.stringify({
    screens: devices.screens?.sort() || [],
    audio: devices.audio?.sort() || []
  });
};

/**
 * Format devices from backend response
 */
export const formatDevices = (devices) => {
  return {
    screens: devices.screens?.map(deviceId => ({
      id: deviceId,
      name: devices.deviceNames?.screens?.[deviceId] || `Screen ${parseInt(deviceId) + 1}`,
      type: 'screen'
    })) || [],
    
    audio: devices.audio?.map(deviceId => ({
      id: deviceId,
      name: devices.deviceNames?.audio?.[deviceId] || `Audio Input ${parseInt(deviceId) + 1}`,
      type: 'input'
    })) || []
  };
};

/**
 * Get error message with suggestions based on error type
 */
export const getErrorMessage = (error, selectedScreen, selectedAudioInput) => {
  const errorMsg = error.message || 'Failed to start recording';
  
  if (errorMsg.includes('permission')) {
    return {
      message: '❌ Permission error: Please check screen recording permissions in System Preferences → Privacy & Security → Screen Recording',
      type: 'permission'
    };
  } else if (errorMsg.includes('device') || errorMsg.includes('framerate')) {
    return {
      message: `❌ Device error: Try selecting a different screen or audio device. Current: Screen ${selectedScreen}, Audio ${selectedAudioInput}`,
      type: 'device'
    };
  } else {
    return {
      message: '❌ Recording failed: ' + errorMsg,
      type: 'general'
    };
  }
};