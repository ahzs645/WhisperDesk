# WhisperDesk Tauri - Quick Start Guide

## 🚀 What We Built

Your Tauri app now has **full Whisper transcription** powered by Vibe's native Rust pipeline!

---

## 📦 Installation

### 1. Install Dependencies

```bash
# From the project root
cd apps/native
pnpm install
```

### 2. Build the App

```bash
pnpm tauri dev
```

---

## 🎯 Usage in Your React App

### Option 1: Using Hooks (Recommended)

```tsx
import { useTranscription, useModel } from './lib';

export function MyTranscriptionComponent() {
  const { load, isModelLoaded } = useModel();
  const { start, progress, segments, isTranscribing } = useTranscription({
    onComplete: (result) => {
      console.log('Done!', result);
    },
  });

  return (
    <div>
      <button onClick={() => load({ model_path: '/path/to/model.bin' })}>
        Load Model
      </button>

      <button
        onClick={() => start({ audio_path: '/path/to/audio.wav' })}
        disabled={!isModelLoaded}
      >
        Start Transcription
      </button>

      <div>Progress: {progress}%</div>

      {segments.map((seg, i) => (
        <div key={i}>{seg.text}</div>
      ))}
    </div>
  );
}
```

### Option 2: Direct API Calls

```tsx
import { loadModel, transcribe } from './lib/tauri-bindings';

async function doTranscription() {
  // 1. Load model
  await loadModel({
    model_path: '/Users/you/models/ggml-base.bin',
    use_gpu: true,
  });

  // 2. Transcribe
  const result = await transcribe({
    audio_path: '/Users/you/audio/test.wav',
    language: 'en',
    word_timestamps: true,
  });

  console.log(result.segments);
}
```

---

## 📝 Example Component

We've included a demo component at `src/components/TranscriptionDemo.tsx`.

To use it in your app:

```tsx
// In your App.tsx or main component
import { TranscriptionDemo } from './components/TranscriptionDemo';

function App() {
  return <TranscriptionDemo />;
}
```

---

## 🧪 Testing

### 1. Download a Whisper Model

```bash
mkdir -p ~/WhisperDesk/models
cd ~/WhisperDesk/models

# Download tiny model (fastest, least accurate)
curl -L -o ggml-tiny.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin

# Or base model (balanced)
curl -L -o ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
```

### 2. Get Test Audio

```bash
# Generate a test WAV file (5 seconds of silence)
ffmpeg -f lavfi -i anullsrc=r=16000:cl=mono -t 5 -c:a pcm_s16le test.wav

# Or download a sample
curl -L -o sample.wav "https://github.com/thewh1teagle/vibe/raw/main/samples/sample.wav"
```

### 3. Run the App

```bash
pnpm tauri dev
```

In the app:
1. Select the model you downloaded
2. Enter the path to your audio file
3. Click "Start Transcription"
4. Watch the segments appear in real-time!

---

## 🔌 Available APIs

### Commands

```typescript
// Model Management
loadModel(options: LoadModelOptions): Promise<string>
listModels(modelsDir: string): Promise<string[]>
getModelsFolder(): Promise<string>

// Transcription
transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>
stopTranscription(): Promise<void>
getTranscriptionStatus(): Promise<string>

// Audio
getAudioDevices(): Promise<AudioDevice[]>
getFfmpegPath(): Promise<string>

// Settings
getSetting<T>(key: string): Promise<T | null>
setSetting<T>(key: string, value: T): Promise<void>
getAllSettings(): Promise<Record<string, any>>

// App
getAppInfo(): Promise<AppInfo>
getPlatform(): Promise<string>
quitApp(): Promise<void>
```

### Events

```typescript
onTranscriptionProgress((progress: number) => void)
onTranscriptionSegment((segment: TranscriptionSegment) => void)
```

---

## 🛠️ Customization

### Transcription Options

```typescript
interface TranscriptionRequest {
  audio_path: string;          // Required: path to audio file
  language?: string;           // Optional: 'en', 'es', 'fr', etc.
  translate?: boolean;         // Optional: translate to English
  word_timestamps?: boolean;   // Optional: word-level timestamps
  max_sentence_len?: number;   // Optional: max words per segment
}
```

### Model Options

```typescript
interface LoadModelOptions {
  model_path: string;   // Required: absolute path to model
  gpu_device?: number;  // Optional: GPU device index
  use_gpu?: boolean;    // Optional: enable GPU acceleration
}
```

---

## 🐛 Common Issues

### "No model loaded" Error
→ Make sure to call `loadModel()` before `transcribe()`

### "Model file not found"
→ Use absolute paths: `/Users/you/models/ggml-base.bin`

### "FFmpeg not found"
→ Install FFmpeg: `brew install ffmpeg`

### Slow Transcription
→ Try enabling GPU: `use_gpu: true` in `loadModel()`

---

## 📚 Next Steps

1. **Integrate with your existing UI** - Replace demo component with your design
2. **Add file picker** - Use `@tauri-apps/plugin-dialog` for file selection
3. **Save transcriptions** - Use `@tauri-apps/plugin-fs` to save results
4. **Add model downloader** - Implement automatic model downloads
5. **Screen recording integration** - Connect your screen recorder to transcription

---

## 💡 Pro Tips

- **Model sizes:**
  - `tiny` - Fastest, least accurate (~75MB)
  - `base` - Good balance (~140MB)
  - `small` - Better accuracy (~460MB)
  - `medium` - Very accurate (~1.5GB)

- **Audio format:**
  - Best: 16kHz, mono, WAV
  - Supported: Most formats (converted automatically via FFmpeg)

- **GPU Acceleration:**
  - macOS: Uses CoreML automatically
  - Windows: CUDA/DirectML support available
  - Linux: CUDA/Vulkan support available

---

**Happy transcribing! 🎤→📝**
