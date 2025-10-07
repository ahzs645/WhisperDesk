/**
 * React hooks for transcription functionality
 */

import { useCallback, useEffect, useState } from 'react';
import {
  transcribe,
  stopTranscription,
  getTranscriptionStatus,
  onTranscriptionProgress,
  onTranscriptionSegment,
  type TranscriptionRequest,
  type TranscriptionResult,
  type TranscriptionSegment,
} from '../tauri-bindings';

export interface UseTranscriptionOptions {
  onProgress?: (progress: number) => void;
  onSegment?: (segment: TranscriptionSegment) => void;
  onComplete?: (result: TranscriptionResult) => void;
  onError?: (error: Error) => void;
}

export function useTranscription(options: UseTranscriptionOptions = {}) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);

  // Set up event listeners
  useEffect(() => {
    let unlistenProgress: (() => void) | null = null;
    let unlistenSegment: (() => void) | null = null;

    const setupListeners = async () => {
      // Progress listener
      unlistenProgress = await onTranscriptionProgress((prog) => {
        setProgress(prog);
        options.onProgress?.(prog);
      });

      // Segment listener
      unlistenSegment = await onTranscriptionSegment((segment) => {
        setSegments((prev) => [...prev, segment]);
        options.onSegment?.(segment);
      });
    };

    setupListeners();

    return () => {
      unlistenProgress?.();
      unlistenSegment?.();
    };
  }, [options.onProgress, options.onSegment]);

  const start = useCallback(
    async (request: TranscriptionRequest) => {
      setIsTranscribing(true);
      setProgress(0);
      setSegments([]);
      setError(null);
      setResult(null);

      try {
        const transcriptionResult = await transcribe(request);
        setResult(transcriptionResult);
        setProgress(100);
        options.onComplete?.(transcriptionResult);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        options.onError?.(error);
      } finally {
        setIsTranscribing(false);
      }
    },
    [options.onComplete, options.onError]
  );

  const stop = useCallback(async () => {
    try {
      await stopTranscription();
      setIsTranscribing(false);
    } catch (err) {
      console.error('Failed to stop transcription:', err);
    }
  }, []);

  const reset = useCallback(() => {
    setProgress(0);
    setSegments([]);
    setError(null);
    setResult(null);
  }, []);

  return {
    isTranscribing,
    progress,
    segments,
    error,
    result,
    start,
    stop,
    reset,
  };
}
