// Mock Tauri API for development and testing
// This simulates Tauri's invoke function with fake data

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  text: string;
  duration: number;
  language?: string;
}

export interface Model {
  name: string;
  size: string;
  downloaded: boolean;
  downloadProgress?: number;
  description: string;
}

export interface AppInfo {
  version: string;
  name: string;
  platform: string;
}

export interface RecorderStatus {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  outputPath?: string;
}

// Simulated delay for realistic feel
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock storage for settings
const mockSettings: Record<string, any> = {
  theme: 'dark',
  language: 'en',
  autoSave: true,
  model: 'tiny',
};

// Mock models database
const mockModels: Model[] = [
  {
    name: 'tiny',
    size: '75 MB',
    downloaded: true,
    description: 'Fastest, least accurate'
  },
  {
    name: 'base',
    size: '142 MB',
    downloaded: true,
    description: 'Fast, good accuracy'
  },
  {
    name: 'small',
    size: '466 MB',
    downloaded: false,
    description: 'Balanced speed and accuracy'
  },
  {
    name: 'medium',
    size: '1.5 GB',
    downloaded: false,
    description: 'Slower, high accuracy'
  },
  {
    name: 'large-v2',
    size: '2.9 GB',
    downloaded: false,
    description: 'Best accuracy, slowest'
  },
];

// Mock transcription data
const mockTranscriptions: TranscriptionResult[] = [
  {
    text: "Welcome to WhisperDesk, a powerful transcription tool. This is a sample transcription showing how the app works with real data.",
    duration: 12.5,
    language: "en",
    segments: [
      { id: 0, start: 0.0, end: 3.2, text: "Welcome to WhisperDesk, a powerful transcription tool.", speaker: "Speaker 1" },
      { id: 1, start: 3.5, end: 7.8, text: "This is a sample transcription showing how the app works.", speaker: "Speaker 1" },
      { id: 2, start: 8.0, end: 12.5, text: "You can see multiple speakers and timestamps here.", speaker: "Speaker 2" },
    ]
  }
];

let mockRecorderStatus: RecorderStatus = {
  isRecording: false,
  isPaused: false,
  duration: 0,
};

// Mock Tauri invoke function
export async function mockInvoke(command: string, args?: any): Promise<any> {
  console.log('[Mock Tauri]', command, args);

  await delay(300); // Simulate network delay

  switch (command) {
    // App commands
    case 'get_app_info':
      return {
        version: '0.1.0',
        name: 'WhisperDesk',
        platform: navigator.platform.includes('Mac') ? 'macOS' :
                  navigator.platform.includes('Win') ? 'Windows' : 'Linux'
      };

    case 'get_platform':
      return navigator.platform.includes('Mac') ? 'macOS' :
             navigator.platform.includes('Win') ? 'Windows' : 'Linux';

    case 'quit_app':
      console.log('Mock: Quit app requested');
      return null;

    case 'restart_app':
      console.log('Mock: Restart app requested');
      window.location.reload();
      return null;

    // Settings commands
    case 'get_setting':
      return mockSettings[args.key] ?? null;

    case 'set_setting':
      mockSettings[args.key] = args.value;
      return null;

    case 'get_all_settings':
      return mockSettings;

    case 'delete_setting':
      delete mockSettings[args.key];
      return null;

    case 'reset_settings':
      Object.keys(mockSettings).forEach(key => delete mockSettings[key]);
      return null;

    // Model commands
    case 'list_models':
      return mockModels;

    case 'download_model':
      const model = mockModels.find(m => m.name === args.modelName);
      if (model) {
        // Simulate download progress
        model.downloadProgress = 0;
        const interval = setInterval(() => {
          if (model.downloadProgress! >= 100) {
            clearInterval(interval);
            model.downloaded = true;
            model.downloadProgress = undefined;
          } else {
            model.downloadProgress! += 10;
          }
        }, 500);
      }
      return null;

    case 'delete_model':
      const modelToDelete = mockModels.find(m => m.name === args.modelName);
      if (modelToDelete) {
        modelToDelete.downloaded = false;
      }
      return null;

    case 'get_model_info':
      return mockModels.find(m => m.name === args.modelName) || null;

    // Transcription commands
    case 'start_transcription':
      await delay(2000); // Simulate transcription time
      return mockTranscriptions[0];

    case 'stop_transcription':
      return null;

    case 'get_transcription_status':
      return 'idle';

    // Screen recorder commands
    case 'get_recorder_status':
      return mockRecorderStatus;

    case 'start_recording':
      mockRecorderStatus = {
        isRecording: true,
        isPaused: false,
        duration: 0,
        outputPath: '/tmp/recording.mp4'
      };
      return null;

    case 'stop_recording':
      const result = { ...mockRecorderStatus };
      mockRecorderStatus = {
        isRecording: false,
        isPaused: false,
        duration: 0,
      };
      return result;

    case 'pause_recording':
      mockRecorderStatus.isPaused = true;
      return null;

    case 'resume_recording':
      mockRecorderStatus.isPaused = false;
      return null;

    // File commands
    case 'open_file':
      // Simulate file picker
      return '/path/to/audio/file.mp3';

    case 'save_file':
      return '/path/to/saved/file.txt';

    case 'read_file':
      return 'Mock file content';

    case 'write_file':
      return null;

    // Export commands
    case 'export_transcription':
      return { success: true, path: '/path/to/export.txt' };

    default:
      console.warn('[Mock Tauri] Unknown command:', command);
      throw new Error(`Unknown command: ${command}`);
  }
}

// Check if we're running in Tauri or browser
export const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Wrapper that uses real Tauri if available, otherwise mock
export async function invoke(command: string, args?: any): Promise<any> {
  if (isTauri()) {
    // @ts-ignore - Tauri API will be available at runtime
    return window.__TAURI__.invoke(command, args);
  } else {
    return mockInvoke(command, args);
  }
}

// Mock event listener
export function listen(event: string, handler: (payload: any) => void) {
  console.log('[Mock Tauri] Listening to event:', event);

  // Return unlisten function
  return () => {
    console.log('[Mock Tauri] Unlistening from event:', event);
  };
}

// Mock emit
export function emit(event: string, payload: any) {
  console.log('[Mock Tauri] Emitting event:', event, payload);
}
