# 🤖 Automated Release System

WhisperDesk Enhanced utilizes GitHub Actions to automate the process of building, testing, and releasing optimized versions of the application for multiple platforms. This ensures consistency and reliability in our releases.

## Overview of the CI/CD Pipeline

The primary workflow is typically defined in a file like `.github/workflows/main.yml` or `.github/workflows/release.yml`. Here's a general outline of what the automated system does:

1.  **Trigger**:
    *   Workflows are usually triggered on pushes to specific branches (e.g., `main` or `develop`).
    *   Tagging a commit (e.g., `v1.0.0`) often triggers a release workflow.
    *   Pull requests to the main branch might trigger build and test workflows.

2.  **Setup Environment**:
    *   The workflow sets up the necessary build environment, which might include specific versions of Node.js, Python (if needed for helper scripts, though the core app aims to be Python-free), and operating system-specific dependencies.

3.  **Checkout Code**:
    *   Fetches the latest code from the repository, including any submodules (like `whisper.cpp` if it's included that way).

4.  **Install Dependencies**:
    *   Installs Node.js dependencies for the main application and the UI: `npm install` and frontend dependencies.

5.  **Build Native Components**:
    *   A crucial step is building the `whisper.cpp` binary for each target platform (Windows, macOS x64/arm64, Linux). This involves:
        *   Compiling the C/C++ code with appropriate flags for optimization and platform compatibility (e.g., AVX2, Metal support for macOS).
        *   Ensuring the compiled binary is placed in the correct location (e.g., `binaries/`) for Electron Builder to package.

6.  **Build the Application**:
    *   Runs `npm run build` to prepare the Electron application (transpiling code, bundling assets).

7.  **Run Tests**:
    *   Executes automated tests (e.g., `npm run test:native`, `npm test`) to ensure the application is functioning correctly on the build agent.

8.  **Package Application (Electron Builder)**:
    *   Uses `electron-builder` (via scripts like `npm run dist` or `npm run dist:all`) to package the application into distributable formats for each target platform:
        *   **Windows**: `.exe` installer, portable `.exe`.
        *   **macOS**: `.dmg` for Intel (`x64`) and Apple Silicon (`arm64`).
        *   **Linux**: `.AppImage`, `.deb`, `.rpm`.

9.  **Code Signing (Optional but Recommended for Releases)**:
    *   For official releases, the macOS and Windows binaries are often code-signed to avoid security warnings and comply with platform requirements. This involves using certificates and secrets stored securely (e.g., in GitHub Secrets).

10. **Create Release Artifacts**:
    *   The packaged application files (installers, AppImages, etc.) are uploaded as artifacts associated with the workflow run.

11. **Create GitHub Release (for tagged commits)**:
    *   If the workflow was triggered by a tag:
        *   A new GitHub Release is drafted or published.
        *   Release notes might be automatically generated based on commit messages or manually provided.
        *   The build artifacts (installers, etc.) are attached to the GitHub Release for users to download.

12. **Notifications (Optional)**:
    *   Notify developers or a community channel about the status of builds or new releases.

## Release Schedule & Strategy

*   **Stable Releases**:
    *   Triggered by creating and pushing a version tag (e.g., `v1.0.0`, `v1.1.0`).
    *   These undergo full testing and are intended for general users.
    *   Binaries are typically code-signed.
*   **Beta Releases / Pre-releases**:
    *   May be triggered by tags with suffixes like `-beta.1`, `-rc.1`.
    *   Used for testing new features before a stable release.
    *   May also be code-signed.
*   **Automatic Builds / Nightly Builds (Optional)**:
    *   Some projects configure workflows to run on every push to the `main` or `develop` branch.
    *   These builds produce artifacts that can be used for internal testing or by users who want the absolute latest (but potentially less stable) version. These are usually not full "releases" on GitHub but artifacts stored with the workflow run.

This automated system helps maintain a high quality for releases and allows developers to focus on building features rather than manual release procedures. For specific details on the build matrix, compilation flags, and workflow steps, refer to the YAML files in the `.github/workflows` directory of the project.
