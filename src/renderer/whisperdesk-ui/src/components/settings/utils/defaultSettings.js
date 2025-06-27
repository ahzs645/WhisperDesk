// src/renderer/whisperdesk-ui/src/components/settings/utils/defaultSettings.js

export const DEFAULT_SETTINGS = {
  // Recording settings
  recordingDirectory: '',
  includeMicrophone: true,
  includeSystemAudio: true,
  autoTranscribeRecordings: true,
  recordingQuality: 'medium',
  videoQuality: 'medium',
  audioQuality: 'medium',
  
  // Transcription settings
  defaultProvider: 'whisper-native',
  defaultModel: 'whisper-tiny',
  autoDetectLanguage: true,
  enableTimestamps: true,
  enableSpeakerDiarization: true,
  maxSpeakers: 10,
  
  // Export settings
  defaultExportFormat: 'txt',
  includeTimestampsInExport: false,
  includeSpeakerLabels: true,
  exportDirectory: '',
  
  // UI settings
  theme: 'system',
  showWaveform: true,
  showTimeline: true,
  autoScroll: true,
  fontSize: 'medium',
  
  // Advanced settings
  enableTelemetry: false,
  enableAutoUpdates: true,
  logLevel: 'info'
};