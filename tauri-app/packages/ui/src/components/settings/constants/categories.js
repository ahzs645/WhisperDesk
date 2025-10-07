// src/renderer/whisperdesk-ui/src/components/settings/constants/categories.js

import { 
  Video, 
  Mic, 
  FileText, 
  Palette, 
  Settings 
} from 'lucide-react';

export const SETTING_CATEGORIES = [
  {
    id: 'recording',
    title: 'Recording',
    icon: Video,
    description: 'Screen capture and audio settings'
  },
  {
    id: 'transcription',
    title: 'Transcription',
    icon: Mic,
    description: 'AI model and processing settings'
  },
  {
    id: 'export',
    title: 'Export',
    icon: FileText,
    description: 'Output formats and destinations'
  },
  {
    id: 'interface',
    title: 'Interface',
    icon: Palette,
    description: 'Appearance and layout preferences'
  },
  {
    id: 'advanced',
    title: 'Advanced',
    icon: Settings,
    description: 'System and developer options'
  }
];

export const RECORDING_SETTINGS_KEYS = [
  'includeMicrophone', 
  'includeSystemAudio', 
  'videoQuality', 
  'audioQuality', 
  'recordingDirectory', 
  'autoTranscribeRecordings'
];