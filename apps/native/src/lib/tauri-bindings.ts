/**
 * TypeScript bindings for Tauri commands
 * Auto-generated types based on Rust command signatures
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

// ============================================================================
// Type Definitions
// ============================================================================

export interface TranscriptionRequest {
  audio_path: string;
  language?: string;
  translate?: boolean;
  word_timestamps?: boolean;
  max_sentence_len?: number;
  enable_diarization?: boolean;
  max_speakers?: number;
  diarization_threshold?: number;
}

export interface TranscriptionSegment {
  start: number;
  stop: number;
  text: string;
  speaker?: string;
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  processing_time_sec: number;
}

export interface LoadModelOptions {
  model_path: string;
  gpu_device?: number;
  use_gpu?: boolean;
}

export interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
}

export interface AppInfo {
  name: string;
  version: string;
}

// ============================================================================
// App Commands
// ============================================================================

export async function getAppInfo(): Promise<AppInfo> {
  return invoke('get_app_info');
}

export async function getPlatform(): Promise<string> {
  return invoke('get_platform');
}

export async function quitApp(): Promise<void> {
  return invoke('quit_app');
}

export async function restartApp(): Promise<void> {
  return invoke('restart_app');
}

// ============================================================================
// Settings Commands
// ============================================================================

export async function getSetting<T = any>(key: string): Promise<T | null> {
  return invoke('get_setting', { key });
}

export async function setSetting<T = any>(key: string, value: T): Promise<void> {
  return invoke('set_setting', { key, value });
}

export async function getAllSettings(): Promise<Record<string, any>> {
  return invoke('get_all_settings');
}

export async function deleteSetting(key: string): Promise<void> {
  return invoke('delete_setting', { key });
}

export async function resetSettings(): Promise<void> {
  return invoke('reset_settings');
}

// ============================================================================
// Model Commands
// ============================================================================

export async function loadModel(options: LoadModelOptions): Promise<string> {
  return invoke('load_model', { options });
}

export async function listModels(modelsDir: string): Promise<string[]> {
  return invoke('list_models', { modelsDir });
}

export async function getModelsFolder(): Promise<string> {
  return invoke('get_models_folder');
}

export async function downloadModel(url: string, path: string): Promise<string> {
  return invoke('download_model', { url, path });
}

export async function onDownloadProgress(
  callback: (current: number, total: number) => void
): Promise<UnlistenFn> {
  return listen<[number, number]>('download_progress', (event) => {
    const [current, total] = event.payload;
    callback(current, total);
  });
}

// ============================================================================
// Audio Commands
// ============================================================================

export async function getAudioDevices(): Promise<AudioDevice[]> {
  return invoke('get_audio_devices');
}

export async function getFfmpegPath(): Promise<string> {
  return invoke('get_ffmpeg_path');
}

export async function startRecord(devices: AudioDevice[], storeInDocuments: boolean = false): Promise<void> {
  return invoke('start_record', { devices, storeInDocuments });
}

export async function stopRecord(): Promise<void> {
  // This triggers the stop_record event which the backend listens to
  const { emit } = await import('@tauri-apps/api/event');
  return emit('stop_record');
}

export async function onRecordFinish(
  callback: (data: { path: string; name: string }) => void
): Promise<UnlistenFn> {
  return listen<{ path: string; name: string }>('record_finish', (event) => {
    callback(event.payload);
  });
}

// ============================================================================
// Transcription Commands
// ============================================================================

export async function transcribe(
  request: TranscriptionRequest
): Promise<TranscriptionResult> {
  console.log('[tauri-bindings] Calling invoke with:', { request });
  try {
    const result = await invoke<TranscriptionResult>('transcribe', { request });
    console.log('[tauri-bindings] Invoke returned:', result);
    return result;
  } catch (error) {
    console.error('[tauri-bindings] Invoke error:', error);
    throw error;
  }
}

export async function stopTranscription(): Promise<void> {
  return invoke('stop_transcription');
}

export async function getTranscriptionStatus(): Promise<string> {
  return invoke('get_transcription_status');
}

// ============================================================================
// Event Listeners
// ============================================================================

export async function onTranscriptionProgress(
  callback: (progress: number) => void
): Promise<UnlistenFn> {
  return listen<number>('transcription_progress', (event) => {
    callback(event.payload);
  });
}

export async function onTranscriptionSegment(
  callback: (segment: TranscriptionSegment) => void
): Promise<UnlistenFn> {
  return listen<TranscriptionSegment>('transcription_segment', (event) => {
    callback(event.payload);
  });
}

export async function onAbortTranscription(
  callback: () => void
): Promise<UnlistenFn> {
  return listen('abort_transcription', () => {
    callback();
  });
}

// ============================================================================
// File Dialog & File System Helpers
// ============================================================================

export async function selectAudioFile(): Promise<string | null> {
  const result = await open({
    multiple: false,
    filters: [
      {
        name: 'Audio',
        extensions: ['wav', 'mp3', 'm4a', 'flac', 'ogg', 'opus', 'webm', 'mp4', 'mkv', 'avi']
      }
    ]
  });

  if (result === null) return null;
  return result as string;
}

export async function saveTranscription(content: string, defaultName?: string): Promise<string | null> {
  const result = await open({
    multiple: false,
    directory: false,
    defaultPath: defaultName || 'transcription.txt',
    filters: [
      {
        name: 'Text',
        extensions: ['txt', 'md', 'srt', 'vtt', 'json']
      }
    ]
  });

  if (result === null) return null;
  const path = result as string;

  await writeTextFile(path, content);
  return path;
}

export async function readTranscriptionFile(path: string): Promise<string> {
  return await readTextFile(path);
}
