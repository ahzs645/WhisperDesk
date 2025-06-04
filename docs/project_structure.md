# 📁 Project Structure

This document outlines the directory structure of the WhisperDesk Enhanced project.

```
WhisperDesk/
├── src/
│   ├── main/                          # Electron main process
│   │   ├── services/
│   │   │   ├── binary-manager.js      # Manages whisper.cpp binaries
│   │   │   ├── transcription-service-native.js  # Native transcription service
│   │   │   └── providers/
│   │   │       └── native-whisper-provider.js   # Native whisper provider
│   │   └── main.js                    # Main process entry point
│   └── renderer/                      # React frontend (Vite + React + ShadCN UI)
│       └── whisperdesk-ui/
│           ├── src/App.jsx            # Main application component (example)
│           └── components/
│               ├── TranscriptionTab-Electron.jsx  # Electron transcription interface (example)
│               └── ModelMarketplace-WebCompatible.jsx     # Model management (example)
├── binaries/
│   └── whisper-cli                    # Pre-compiled whisper.cpp binary (platform-specific)
├── scripts/
│   ├── build-whisper.sh               # (Unix) Script to build whisper.cpp from source
│   ├── compile-whisper-windows.ps1    # (Windows) PowerShell script to compile whisper.cpp
│   ├── build-whisper-cross-platform.js # Node.js script for cross-platform whisper.cpp builds
│   ├── download-models.js             # Script to download whisper models
│   ├── setup.sh                       # Automated setup script for Linux/macOS
│   └── setup.ps1                      # Automated setup script for Windows (PowerShell)
│   └── diagnose-whisper-windows.ps1   # Windows diagnostic script for whisper.cpp issues
├── resources/                         # Icons, installer assets, etc.
├── test-native-services.js            # Script for testing native services
├── test-transcription.js              # Script for testing transcription functionality
├── transcription-server.js            # API server for the web interface
├── package.json                       # Project dependencies and scripts
├── README.md                          # This file
└── .github/                           # GitHub specific files (workflows, issue templates)
```

**Key Directories:**

*   **`src/main`**: Contains the code for the Electron main process. This includes services for managing binaries, handling transcriptions natively, and other core backend functionalities.
*   **`src/renderer/whisperdesk-ui`**: Houses the frontend application built with Vite, React, and likely UI components from a library like ShadCN UI. This is what users interact with.
*   **`binaries`**: Stores pre-compiled versions of the `whisper-cli` tool for different platforms if they are not built from source during setup.
*   **`scripts`**: A collection of utility scripts for building the application, compiling native components (like whisper.cpp), downloading models, and setting up the development environment.
*   **`resources`**: Contains static assets used by the application, such as icons, images for installers (like DMG backgrounds), and platform-specific resource files.
*   **`.github`**: Holds GitHub-specific configurations, primarily for CI/CD workflows (e.g., `main.yml` for automated builds and releases).
*   **`docs`**: (This directory, if you are reading this from the file system) Contains additional documentation files.

This structure aims to separate concerns: main process logic, UI rendering, build/utility scripts, and native binaries, making the project easier to navigate and maintain.
