/**
 * @fileoverview Type definitions and interfaces for the screen recorder system
 */

/**
 * @typedef {Object} ScreenSource
 * @property {string} id - Unique identifier for the screen source
 * @property {string} name - Display name of the screen source
 * @property {'screen'|'window'} type - Type of source
 * @property {string} [displayId] - Display ID for screen sources
 * @property {string} [appName] - Application name for window sources
 */

/**
 * @typedef {Object} AudioDevice
 * @property {string} id - Unique identifier for the audio device
 * @property {string} name - Display name of the audio device
 * @property {'audioinput'|'audiooutput'} type - Type of audio device
 * @property {string} [groupId] - Group ID for related devices
 */

/**
 * @typedef {Object} RecordingOptions
 * @property {string} screenId - ID of the screen source to record
 * @property {string} [audioInputId] - ID of the audio input device
 * @property {boolean} [includeMicrophone=true] - Whether to include microphone audio
 * @property {boolean} [includeSystemAudio=false] - Whether to include system audio
 * @property {'low'|'medium'|'high'} [videoQuality='medium'] - Video quality setting
 * @property {'low'|'medium'|'high'} [audioQuality='medium'] - Audio quality setting
 * @property {string} [recordingDirectory] - Directory to save recordings
 * @property {string} [filename] - Custom filename for the recording
 */

/**
 * @typedef {Object} RecordingStatus
 * @property {boolean} isRecording - Whether recording is currently active
 * @property {boolean} isPaused - Whether recording is paused
 * @property {number} duration - Duration of current recording in milliseconds
 * @property {string} [outputPath] - Path where recording will be saved
 * @property {string} [actualOutputPath] - Actual path where recording was saved
 * @property {boolean} recordingValidated - Whether recording has been validated
 * @property {boolean} hasActiveProcess - Whether there's an active recording process
 * @property {string} [error] - Last error message if any
 * @property {Object} [availableDevices] - Available devices information
 */

/**
 * @typedef {Object} RecordingResult
 * @property {boolean} success - Whether the operation was successful
 * @property {string} [error] - Error message if operation failed
 * @property {string} [type] - Type of error for categorization
 * @property {string} [outputPath] - Path to the recorded file
 * @property {ScreenSource} [screenSource] - Information about the recorded source
 * @property {Object} [details] - Additional details about the operation
 */

/**
 * @typedef {Object} DeviceValidation
 * @property {boolean} valid - Whether the device selection is valid
 * @property {string[]} issues - List of validation issues
 * @property {Object} [suggestions] - Suggested fixes for issues
 */

/**
 * @typedef {Object} PermissionStatus
 * @property {'granted'|'denied'|'unknown'} screen - Screen recording permission status
 * @property {'granted'|'denied'|'unknown'} microphone - Microphone permission status
 * @property {'granted'|'denied'|'unknown'} [camera] - Camera permission status
 */

/**
 * Recording events that can be emitted
 */
const RECORDING_EVENTS = {
  STARTED: 'started',
  COMPLETED: 'completed',
  PAUSED: 'paused',
  RESUMED: 'resumed',
  ERROR: 'error',
  PROGRESS: 'progress',
  VALIDATED: 'validated',
  DEVICES_REFRESHED: 'devicesRefreshed',
  AUDIO_DEVICES_UPDATED: 'audioDevicesUpdated'
};

/**
 * Recording states
 */
const RECORDING_STATES = {
  IDLE: 'idle',
  STARTING: 'starting',
  RECORDING: 'recording',
  PAUSED: 'paused',
  STOPPING: 'stopping',
  COMPLETED: 'completed',
  ERROR: 'error'
};

/**
 * Error types for categorization
 */
const ERROR_TYPES = {
  SERVICE_UNAVAILABLE: 'service_unavailable',
  VALIDATION_ERROR: 'validation_error',
  START_ERROR: 'start_error',
  STOP_ERROR: 'stop_error',
  PAUSE_ERROR: 'pause_error',
  RESUME_ERROR: 'resume_error',
  PERMISSION_ERROR: 'permission_error',
  DEVICE_ERROR: 'device_error',
  FILE_ERROR: 'file_error'
};

module.exports = {
  RECORDING_EVENTS,
  RECORDING_STATES,
  ERROR_TYPES
}; 