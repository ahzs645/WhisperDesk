/**
 * Example component demonstrating transcription functionality
 */

import { useState } from 'react';
import { useTranscription, useModel, useModelList } from '../lib/hooks';

export function TranscriptionDemo() {
  const [audioPath, setAudioPath] = useState('');
  const [language, setLanguage] = useState('en');

  // Model management
  const { isModelLoaded, currentModel, load: loadModel } = useModel();
  const { models, modelsFolder } = useModelList();

  // Transcription
  const {
    isTranscribing,
    progress,
    segments,
    error,
    result,
    start,
    stop,
    reset,
  } = useTranscription({
    onProgress: (prog) => {
      console.log('Progress:', prog);
    },
    onSegment: (segment) => {
      console.log('New segment:', segment);
    },
    onComplete: (res) => {
      console.log('Transcription complete!', res);
    },
    onError: (err) => {
      console.error('Transcription error:', err);
    },
  });

  const handleLoadModel = async (modelName: string) => {
    const modelPath = `${modelsFolder}/${modelName}`;
    await loadModel({ model_path: modelPath, use_gpu: true });
  };

  const handleStartTranscription = async () => {
    if (!audioPath) {
      alert('Please enter an audio file path');
      return;
    }

    await start({
      audio_path: audioPath,
      language: language || undefined,
      word_timestamps: true,
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Transcription Demo</h1>

      {/* Model Selection */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">1. Load Model</h2>
        <div className="flex gap-2">
          <select
            className="flex-1 px-4 py-2 border rounded"
            onChange={(e) => handleLoadModel(e.target.value)}
            disabled={!models.length}
          >
            <option value="">Select a model...</option>
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          {isModelLoaded && (
            <span className="px-4 py-2 bg-green-100 text-green-800 rounded">
              ✓ Loaded: {currentModel?.split('/').pop()}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600">Models folder: {modelsFolder}</p>
      </div>

      {/* Audio Input */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">2. Select Audio File</h2>
        <input
          type="text"
          placeholder="/path/to/audio.wav"
          value={audioPath}
          onChange={(e) => setAudioPath(e.target.value)}
          className="w-full px-4 py-2 border rounded"
        />
      </div>

      {/* Language Selection */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">3. Language (optional)</h2>
        <input
          type="text"
          placeholder="en, es, fr, etc."
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full px-4 py-2 border rounded"
        />
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={handleStartTranscription}
          disabled={!isModelLoaded || isTranscribing}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTranscribing ? 'Transcribing...' : 'Start Transcription'}
        </button>
        {isTranscribing && (
          <button
            onClick={stop}
            className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Stop
          </button>
        )}
        {result && (
          <button
            onClick={reset}
            className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Reset
          </button>
        )}
      </div>

      {/* Progress */}
      {isTranscribing && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-800 font-semibold">Error:</p>
          <p className="text-red-700">{error.message}</p>
        </div>
      )}

      {/* Real-time Segments */}
      {segments.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Live Segments</h2>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {segments.map((segment, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded">
                <div className="text-xs text-gray-500">
                  {formatTimestamp(segment.start)} -{' '}
                  {formatTimestamp(segment.stop)}
                  {segment.speaker && ` | Speaker: ${segment.speaker}`}
                </div>
                <div className="text-sm">{segment.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Result */}
      {result && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Final Result</h2>
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800">
              Processing time: {result.processing_time_sec}s
            </p>
            <p className="text-sm text-green-800">
              Total segments: {result.segments.length}
            </p>
          </div>
          <div className="p-4 bg-white border rounded max-h-96 overflow-y-auto">
            {result.segments.map((segment, idx) => (
              <p key={idx} className="mb-2">
                {segment.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimestamp(ms: number): string {
  const totalSeconds = ms / 100;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(2);
  return `${minutes}:${seconds.padStart(5, '0')}`;
}
