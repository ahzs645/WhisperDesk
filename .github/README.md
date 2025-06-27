# GitHub Actions Workflow Structure

This directory contains the reorganized GitHub Actions workflows for WhisperDesk, split into logical components for better maintainability and reusability.

## 📁 Directory Structure

```
.github/
├── workflows/
│   ├── build.yml           # Build jobs only (PRs & pushes)
│   ├── release.yml         # Release creation only (tags & manual)
│   ├── test.yml            # Tests, linting, and checks
│   └── reusable/
│       ├── build-platform.yml  # Reusable platform build workflow
│       └── setup-signing.yml   # Code signing setup (unused)
├── actions/
│   ├── setup-build-env/    # Composite action for environment setup
│   ├── build-whisper/      # Composite action for whisper.cpp build
│   ├── build-diarization/  # Composite action for diarization build
│   └── verify-build/       # Composite action for build verification
└── scripts/
    ├── build-whisper.sh     # Shell script for whisper.cpp building
    ├── build-diarization.sh # Shell script for diarization building
    ├── rename-portable.js   # Script to rename ZIP files to Portable
    └── sign-windows.js      # Windows code signing script
```

## 🔄 Workflow Overview

### Build Workflow (`build.yml`)
- **Trigger**: Push to main/master/release branches, PRs, manual dispatch
- **Purpose**: Build and test across all platforms
- **Outputs**: Build artifacts for testing
- **Dependencies**: Uses reusable `build-platform.yml`

### Release Workflow (`release.yml`)
- **Trigger**: Git tags (`v*`), manual dispatch with release flag
- **Purpose**: Create GitHub releases with signed binaries
- **Dependencies**: Uses reusable `build-platform.yml`
- **Outputs**: GitHub release with all platform binaries

### Test Workflow (`test.yml`)
- **Trigger**: Push to main/master/release branches, PRs, manual dispatch
- **Purpose**: Linting, dependency checks, build verification
- **Fast execution**: No actual platform builds, just verification

## 🧩 Reusable Components

### Reusable Workflows

#### `build-platform.yml`
Handles building for a specific platform (Windows, macOS, Linux) and architecture.

**Inputs:**
- `platform`: windows, macos, or linux
- `arch`: x64 or arm64
- `version`: Version string for the build
- `file_version`: File version for naming

**Secrets:**
- `APPLE_CERTIFICATE_P12`: Apple developer certificate (optional)
- `APPLE_CERTIFICATE_PASSWORD`: Certificate password (optional)
- `APPLE_TEAM_ID`: Apple team ID (optional)

### Composite Actions

#### `setup-build-env`
Sets up Node.js, pnpm, and platform-specific dependencies.

#### `build-whisper`
Builds whisper.cpp binary for the target platform using official repository.

#### `build-diarization`
Builds the enhanced multi-speaker diarization system.

#### `verify-build`
Verifies all build prerequisites are met before proceeding with Electron build.

## 🚀 Benefits of This Structure

### 1. **Separation of Concerns**
- **Build**: Only handles building and testing
- **Release**: Only handles release creation
- **Test**: Only handles code quality checks

### 2. **Faster Feedback**
- PRs only run build and test workflows
- Release workflow only runs when creating releases
- Test workflow provides quick feedback on code quality

### 3. **Reusability**
- Platform builds are reusable across build and release workflows
- Composite actions eliminate code duplication
- Scripts can be shared and version controlled

### 4. **Maintainability**
- Each workflow has a single responsibility
- Changes to build logic only affect relevant workflows
- Easier to debug and modify specific functionality

### 5. **Scalability**
- Easy to add new platforms or architectures
- Can extend with additional test types
- Supports parallel development by multiple team members

## 🔧 Usage Examples

### Running a Build
```bash
# Automatically triggered on PR
git push origin feature-branch

# Manual build
gh workflow run build.yml
```

### Creating a Release
```bash
# Tag-based release (automatic)
git tag v2.1.0
git push origin v2.1.0

# Manual release
gh workflow run release.yml -f create_release=true -f release_tag=v2.1.0
```

### Running Tests Only
```bash
# Automatically triggered on push/PR
# Or manually:
gh workflow run test.yml
```

## 🔐 Code Signing

### Windows
- Uses self-signed certificates for CI builds
- Production builds should use proper code signing certificates
- Set `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` secrets

### macOS
- Supports Apple Developer certificates via secrets:
  - `APPLE_CERTIFICATE_P12`: Base64-encoded P12 certificate
  - `APPLE_CERTIFICATE_PASSWORD`: Certificate password
  - `APPLE_TEAM_ID`: Apple developer team ID
- Falls back to ad-hoc signing if certificates not available

### Linux
- No code signing required
- Builds create AppImage, DEB, RPM, and TAR.GZ packages

## 📦 Artifacts

Each platform build creates artifacts with the following naming:
- **Windows**: `WhisperDesk-Setup-{version}-win-x64.exe`, `WhisperDesk-Portable-{version}-win-x64.zip`
- **macOS**: `WhisperDesk-Portable-{version}-mac-{arch}.zip`
- **Linux**: `WhisperDesk-{version}-linux-x64.{AppImage,deb,rpm,tar.gz}`

## 🐛 Troubleshooting

### Build Failures
1. Check the specific platform build logs
2. Verify dependencies are correctly installed
3. Check for platform-specific issues in composite actions

### Signing Issues
1. Verify certificates are properly configured in secrets
2. Check certificate expiration dates
3. Review signing scripts for platform-specific errors

### Missing Artifacts
1. Ensure build workflow completed successfully
2. Check artifact upload/download steps
3. Verify file naming patterns match expectations

## 🔄 Migration Notes

This structure replaces the monolithic `main.yml` workflow with:
- Cleaner separation of build vs. release logic
- Faster CI feedback for development
- Better organization of reusable components
- Improved maintainability and debugging

The original workflow functionality is preserved while providing better structure for future development.
