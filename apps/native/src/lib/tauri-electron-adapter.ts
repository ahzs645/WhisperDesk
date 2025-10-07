/**
 * Tauri to Electron API Adapter
 *
 * This file creates a window.electronAPI object that mimics the Electron IPC API,
 * but uses Tauri commands under the hood. This allows your existing Electron-based
 * UI code to work without modifications.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import * as tauriBindings from './tauri-bindings';

// Create the electronAPI object that your existing code expects
export const electronAPI = {
  // Window/App APIs
  window: {
    getPlatform: async () => {
      return await tauriBindings.getPlatform();
    },
    getAppInfo: async () => {
      return await tauriBindings.getAppInfo();
    },
    quit: async () => {
      return await tauriBindings.quitApp();
    },
    restart: async () => {
      return await tauriBindings.restartApp();
    },
  },

  // Settings APIs
  settings: {
    get: async (key: string) => {
      return await tauriBindings.getSetting(key);
    },
    set: async (key: string, value: any) => {
      return await tauriBindings.setSetting(key, value);
    },
    getAll: async () => {
      return await tauriBindings.getAllSettings();
    },
    delete: async (key: string) => {
      return await tauriBindings.deleteSetting(key);
    },
    reset: async () => {
      return await tauriBindings.resetSettings();
    },
  },

  // Model APIs
  models: {
    list: async () => {
      const folder = await tauriBindings.getModelsFolder();
      return await tauriBindings.listModels(folder);
    },
    load: async (modelPath: string) => {
      return await tauriBindings.loadModel({
        model_path: modelPath,
        use_gpu: true,
      });
    },
    getFolder: async () => {
      return await tauriBindings.getModelsFolder();
    },
  },

  // Model API (note: singular 'model' vs 'models')
  model: {
    getInstalled: async () => {
      const folder = await tauriBindings.getModelsFolder();
      const models = await tauriBindings.listModels(folder);
      return models.map((name) => ({
        name,
        path: `${folder}/${name}`,
        size: 0, // TODO: Get actual file size
      }));
    },
  },

  // Transcription APIs
  transcription: {
    start: async (options: any) => {
      // Map Electron options to Tauri format
      const tauriRequest = {
        audio_path: options.audioPath || options.path,
        language: options.language,
        translate: options.translate,
        word_timestamps: options.wordTimestamps,
        max_sentence_len: options.maxSentenceLen,
      };
      return await tauriBindings.transcribe(tauriRequest);
    },
    stop: async () => {
      return await tauriBindings.stopTranscription();
    },
    getStatus: async () => {
      return await tauriBindings.getTranscriptionStatus();
    },
    // Get available transcription providers (stub for now)
    getProviders: async () => {
      // Return a default provider for vibe/whisper
      return [
        {
          id: 'whisper',
          name: 'Whisper (Local)',
          type: 'local',
          isAvailable: true,
        },
      ];
    },
    // Event listeners for real-time updates
    onProgress: (callback: (progress: number) => void) => {
      return tauriBindings.onTranscriptionProgress(callback);
    },
    onSegment: (callback: (segment: any) => void) => {
      return tauriBindings.onTranscriptionSegment(callback);
    },
  },

  // Audio/Device APIs
  audio: {
    getDevices: async () => {
      return await tauriBindings.getAudioDevices();
    },
    getFfmpegPath: async () => {
      return await tauriBindings.getFfmpegPath();
    },
  },

  // Screen Recorder API stub
  // TODO: Implement when screen recorder is ready
  screenRecorder: {
    getStatus: async () => {
      console.warn('[Tauri Adapter] Screen recorder not yet implemented');
      return { isRecording: false, isAvailable: false };
    },
    start: async () => {
      console.warn('[Tauri Adapter] Screen recorder not yet implemented');
      return { success: false, error: 'Not implemented yet' };
    },
    startRecording: async (options: any) => {
      console.warn('[Tauri Adapter] Screen recorder not yet implemented');
      return { success: false, error: 'Not implemented yet' };
    },
    stop: async () => {
      console.warn('[Tauri Adapter] Screen recorder not yet implemented');
      return { success: false };
    },
    stopRecording: async () => {
      console.warn('[Tauri Adapter] Screen recorder not yet implemented');
      return { success: false };
    },
    onRecordingStarted: (callback: any) => {
      console.warn('[Tauri Adapter] Screen recorder events not yet implemented');
      return () => {}; // Return unlisten function
    },
    onRecordingStopped: (callback: any) => {
      console.warn('[Tauri Adapter] Screen recorder events not yet implemented');
      return () => {}; // Return unlisten function
    },
    onRecordingError: (callback: any) => {
      console.warn('[Tauri Adapter] Screen recorder events not yet implemented');
      return () => {}; // Return unlisten function
    },
  },

  // Speaker/Diarization API stub
  // TODO: Implement when needed
  speaker: {
    recognize: async () => {
      console.warn('[Tauri Adapter] Speaker recognition not yet implemented');
      return [];
    },
    onSpeakerLabelUpdated: (callback: any) => {
      console.warn('[Tauri Adapter] Speaker label updates not yet implemented');
      // Return a no-op unlisten function
      return () => {};
    },
  },

  // File/Export API stub
  // TODO: Implement when needed
  export: {
    enhancedTranscription: async (data: any, format: string, options: any) => {
      console.warn('[Tauri Adapter] Export not yet implemented');
      return { success: false, error: 'Not implemented yet' };
    },
  },
};

// Inject the API into window object for compatibility
if (typeof window !== 'undefined') {
  (window as any).electronAPI = electronAPI;
  console.log('✅ Tauri-Electron adapter initialized');
  console.log('📦 Available APIs:', Object.keys(electronAPI));
  console.log('⚠️  Note: Some APIs are stubs and will be implemented as needed');
}

export default electronAPI;
