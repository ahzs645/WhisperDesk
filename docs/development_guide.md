# 🚀 Development & Contributing Guide

WhisperDesk Enhanced welcomes contributions! This guide provides information on setting up your development environment, building the application, and contributing to the project.

## For Contributors & Developers

### Development Setup
Details for setting up a development environment are covered in the "🛠️ Build from Source" section in the main [README.md](../README.md#️-build-from-source). Key steps include:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/<PROJECT_OWNER>/whisperdesk-enhanced.git
    cd whisperdesk-enhanced
    ```
2.  **Install Node.js Dependencies:**
    This installs dependencies for the Electron app and the Vite/React frontend.
    ```bash
    npm install
    cd src/renderer/whisperdesk-ui
    npm install --legacy-peer-deps # --legacy-peer-deps might be needed for some UI library compatibility
    cd ../../..
    ```
3.  **Build/Set up the Native `whisper.cpp` Binary:**
    The application relies on a native `whisper.cpp` command-line executable. The automated setup scripts (`scripts/setup.sh` or `scripts/setup.ps1`) usually handle this.
    To build it manually or understand the process:
    ```bash
    npm run build:whisper
    ```
    This command typically invokes:
    *   `scripts/build-whisper.sh` on macOS/Linux
    *   `scripts/compile-whisper-windows.ps1` on Windows

    These scripts compile the `whisper.cpp` source code (often included as a submodule or downloaded) into an executable located in the `binaries` directory.

4.  **Running in Development Mode:**
    Once setup is complete, you can start the application in development mode with hot reloading for the frontend:
    ```bash
    npm run dev
    ```

### Building Releases
To build distributable packages for different platforms:

```bash
# Build all components (compiles frontend, prepares main process code)
npm run build

# Create distribution packages for your current platform
npm run dist

# (If configured) Build for all target platforms (Windows, macOS, Linux)
npm run dist:all
```
These scripts use Electron Builder to package the application into installers (`.exe`, `.dmg`), AppImages, or other platform-specific formats. Configuration for Electron Builder can be found in `package.json` or a dedicated builder configuration file (e.g., `electron-builder.yml`).

### Development Workflow
Here are some common commands used during development:

*   **`npm run dev`**: Starts the Electron application with the frontend in hot-reload mode. This is the primary command for UI development.
*   **`npm run web`**: If you want to test the web interface version (which uses `transcription-server.js` as a backend), this command typically starts the Vite dev server for the UI and the separate backend server.
*   **`npm run server`**: Starts only the backend API server (`transcription-server.js`) if you want to interact with it directly or use a different frontend.
*   **`npm run test:native`**: Executes tests for the native services, ensuring the `whisper.cpp` binary and related functionalities are working correctly.
*   **`npm run build:whisper`**: Specifically rebuilds the `whisper.cpp` native binary.
*   **Linting/Formatting**: Check `package.json` for linting and formatting scripts (e.g., ESLint, Prettier) to maintain code quality.

### Available Build Targets
The application can be built for the following platforms and formats:

*   **Windows**:
    *   `NSIS Installer (.exe)`
    *   `Portable .exe`
*   **macOS (Intel & Apple Silicon)**:
    *   `.dmg` disk images for `x64` (Intel) and `arm64` (Apple Silicon) architectures.
    *   Universal DMG may also be configured.
*   **Linux**:
    *   `.AppImage` (portable, works on most distributions)
    *   `.deb` (for Debian/Ubuntu-based systems)
    *   `.rpm` (for Fedora/Red Hat-based systems)

Build targets are defined in the Electron Builder configuration.

### Contributing Guidelines

We appreciate contributions from the community! To ensure a smooth process, please follow these guidelines:

1.  **Fork the Repository**: Create your own fork of the `whisperdesk-enhanced` repository on GitHub.
2.  **Create a Feature Branch**: For new features or bug fixes, create a descriptive branch from `main` (e.g., `feat/add-new-export-format` or `fix/transcription-error-handling`).
3.  **Make Your Changes**: Implement your feature or bug fix.
    *   Ensure your code follows the existing style and conventions.
    *   Add or update tests if applicable.
4.  **Test Your Changes**:
    *   Run the application locally and test the functionality you've added or modified.
    *   If possible, test on multiple platforms (Windows, macOS, Linux).
    *   Run any relevant test scripts (e.g., `npm run test:native`).
5.  **Update Documentation**: If you've added new features or changed existing behavior, update any relevant documentation (README, other docs files).
6.  **Commit Your Changes**: Use clear and descriptive commit messages.
7.  **Submit a Pull Request (PR)**:
    *   Push your feature branch to your fork.
    *   Open a Pull Request against the `main` branch of the original `whisperdesk-enhanced` repository.
    *   Provide a clear title and description for your PR, explaining the changes and why they are being made. Reference any related issues.
8.  **Ensure CI Passes**: The project likely uses GitHub Actions for Continuous Integration (CI). Ensure all automated checks and builds pass for your PR. Address any failures.
9.  **Code Review**: Be prepared to discuss your changes and make adjustments based on feedback from maintainers.

By contributing, you agree that your contributions will be licensed under the project's license.

Thank you for helping to improve WhisperDesk Enhanced!
