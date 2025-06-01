# WhisperDesk

A desktop application for real-time audio transcription with speaker diarization using OpenAI's Whisper model.

## Features

- Real-time audio capture from microphone and system audio
- Live audio visualization
- Automatic transcription using Whisper
- Speaker diarization
- Cross-platform support (Windows, macOS, Linux)

## Prerequisites

- Node.js 16.x or later
- Python 3.8 or later (for Whisper and diarization)
- Platform-specific audio dependencies:
  - Windows: WASAPI
  - macOS: Core Audio
  - Linux: PulseAudio/ALSA

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/whisperdesk.git
cd whisperdesk
```

2. Install dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Development

To run the application in development mode:

```bash
npm run dev
```

## Building

To build the application for your platform:

```bash
npm run build
```

## Architecture

### Main Process (Node.js)
- Handles audio recording and file I/O
- Manages system audio capture
- Coordinates transcription pipeline
- Integrates with Whisper model

### Renderer Process (Web UI)
- Real-time audio visualization
- Transcription display with speaker labels
- Settings and configuration interface

## License

MIT
