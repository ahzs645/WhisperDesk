# WhisperDesk Enhanced - Build Guide

This guide covers all methods for building WhisperDesk Enhanced across different platforms.

## 🚀 Quick Start

### Automated Build (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd WhisperDesk

# Quick setup and build for current platform
make setup
make build

# Or use the all-in-one script
chmod +x scripts/build-universal.sh
./scripts/build-universal.sh
```

### Manual Build

```bash
# Install dependencies
npm install
cd src/renderer/whisperdesk-ui && pnpm install && cd ../../..

# Build whisper.cpp
make build-whisper

# Download models
make download-models

# Build the app
npm run dist
```

## 🛠️ Build Methods

### 1. GitHub Actions (CI/CD)

The automated pipeline builds for all platforms:

- **Triggers**: Push to `main`/`release` branches, tags starting with `v*`
- **Platforms**: macOS (x64, ARM64), Linux (x64), Windows (x64)
- **Artifacts**: DMG, AppImage, DEB, RPM, EXE, ZIP files

#### Setup:
1. Enable GitHub Actions in your repository
2. Copy `.github/workflows/build.yml` to your repo
3. Push changes or create a tag to trigger builds

### 2. Local Platform Scripts

#### macOS Build
```bash
chmod +x scripts/build-macos.sh
./scripts/build-macos.sh
```

**Requirements:**
- Xcode Command Line Tools
- Homebrew
- Node.js 18+

**Output:**
- `dist/*.dmg` - Installer
- `dist/*.zip` - Portable app

#### Linux Build
```bash
chmod +x scripts/build-linux.sh
./scripts/build-linux.sh
```

**Requirements:**
- build-essential, cmake
- Node.js 18+
- ALSA development libraries

**Output:**
- `dist/*.AppImage` - Portable
- `dist/*.deb` - Debian package
- `dist/*.rpm` - RPM package
- `dist/*.tar.gz` - Tarball

#### Windows Build
```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-windows.ps1
```

**Requirements:**
- Visual Studio Build Tools
- Node.js 18+
- CMake

**Output:**
- `dist/*.exe` - Installer
- `dist/*.zip` - Portable

### 3. Docker Builds

For consistent cross-platform building:

```bash
# Setup Docker buildx
chmod +x scripts/setup-docker-buildx.sh
./scripts/setup-docker-buildx.sh

# Build using Docker
chmod +x scripts/docker-build.sh
./scripts/docker-build.sh
```

### 4. Makefile Targets

```bash
# Show all available targets
make help

# Common commands
make setup        # Complete setup for new developers
make build        # Build for current platform
make build-all    # Build for all platforms (works best on macOS)
make test         # Run all tests
make clean        # Clean build artifacts

# Platform-specific
make build-macos    # macOS only
make build-linux    # Linux
make build-windows  # Windows
```

## 📋 Build Requirements

### System Requirements

| Platform | CPU | RAM | Disk | OS Version |
|----------|-----|-----|------|------------|
| **macOS** | Intel/Apple Silicon | 4GB | 2GB | macOS 10.15+ |
| **Linux** | x64 | 4GB | 2GB | Ubuntu 18.04+, CentOS 7+ |
| **Windows** | x64 | 4GB | 2GB | Windows 10+ |

### Development Dependencies

#### All Platforms
- **Node.js** 18.0.0+
- **npm** 8.0.0+
- **Git** 2.0+
- **CMake** 3.10+

#### Platform-Specific

**macOS:**
- Xcode Command Line Tools
- Homebrew (recommended)

**Linux:**
- build-essential (Ubuntu/Debian)
- Development Tools (CentOS/RHEL)
- ALSA development libraries

**Windows:**
- Visual Studio Build Tools 2022
- Windows SDK

## 🔧 Build Process Details

### 1. whisper.cpp Binary

The build process automatically:
1. Clones whisper.cpp from GitHub
2. Compiles for the target platform
3. Copies the binary to `binaries/` directory

**Manual build:**
```bash
git clone https://github.com/ggerganov/whisper.cpp.git /tmp/whisper.cpp
cd /tmp/whisper.cpp
make -j$(nproc)
cp build/bin/whisper-cli ./binaries/whisper
```

### 2. Model Downloads

Essential models are downloaded during build:
- **Tiny Model** (39MB) - Included for basic functionality
- Additional models can be downloaded via the app

### 3. Renderer Build

The React frontend is built using Vite:
```bash
cd src/renderer/whisperdesk-ui
pnpm run build  # or npm run build
```

### 4. Electron Packaging

electron-builder packages the app with platform-specific configurations:

```bash
# Single platform
npm run dist:mac    # macOS
npm run dist:linux  # Linux  
npm run dist:win    # Windows

# All platforms (works best on macOS)
npm run dist:all
```

## 📦 Output Artifacts

### macOS
- **DMG**: `WhisperDesk-Enhanced-{version}-{arch}.dmg`
- **ZIP**: `WhisperDesk-Enhanced-{version}-{arch}.zip`

### Linux
- **AppImage**: `WhisperDesk-Enhanced-{version}-{arch}.AppImage`
- **DEB**: `WhisperDesk-Enhanced-{version}-{arch}.deb`
- **RPM**: `WhisperDesk-Enhanced-{version}-{arch}.rpm`
- **TAR.GZ**: `WhisperDesk-Enhanced-{version}-{arch}.tar.gz`

### Windows
- **NSIS Installer**: `WhisperDesk-Enhanced-{version}-{arch}.exe`
- **Portable**: `WhisperDesk-Enhanced-{version}-{arch}.zip`

## 🐛 Troubleshooting

### Common Issues

**Binary Build Fails:**
```bash
# Install build dependencies
# macOS:
xcode-select --install
brew install cmake

# Linux:
sudo apt-get install build-essential cmake

# Windows:
choco install visualstudio2022buildtools cmake
```

**Renderer Build Fails:**
```bash
cd src/renderer/whisperdesk-ui
rm -rf node_modules package-lock.json
pnpm install  # or npm install --legacy-peer-deps
```

**Electron Build Fails:**
```bash
# Clear cache and rebuild
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Platform-Specific Issues

**macOS:**
- Code signing disabled by default (`CSC_IDENTITY_AUTO_DISCOVERY=false`)
- May need to allow apps from unidentified developers

**Linux:**
- AppImage may need `--no-sandbox` flag
- Install FUSE for AppImage support: `sudo apt install fuse`

**Windows:**
- Antivirus may flag the executable
- Add build directory to antivirus exclusions

## 🚀 Release Process

### Automated Release (GitHub)

1. **Tag a release:**
```bash
git tag v2.1.0
git push origin v2.1.0
```

2. **GitHub Actions will:**
- Build for all platforms
- Create a release with artifacts
- Generate release notes

### Manual Release

```bash
# Prepare release
make release-prepare

# Create GitHub release (requires gh CLI)
make release-github

# Or upload manually to GitHub releases
```

### Version Management

```bash
# Bump version
make version-patch  # 2.1.0 -> 2.1.1
make version-minor  # 2.1.0 -> 2.2.0  
make version-major  # 2.1.0 -> 3.0.0
```

## 📊 Build Performance

### Expected Build Times

| Platform | Clean Build | Incremental |
|----------|-------------|-------------|
| macOS M1 | 8-12 min | 2-4 min |
| Linux (4 core) | 10-15 min | 3-5 min |
| Windows (4 core) | 12-18 min | 4-6 min |

### Optimization Tips

1. **Use incremental builds** when possible
2. **Enable parallel processing**: `make -j$(nproc)`
3. **Use pnpm** instead of npm for faster installs
4. **Cache dependencies** in CI/CD pipelines
5. **Build only changed platforms** during development

## 🔍 Verification

### Test the Build

```bash
# Test native services
make test-native

# Test transcription
make test-transcription

# Manual testing
./dist/WhisperDesk-Enhanced-*  # Linux
open dist/*.dmg               # macOS
dist/*.exe                    # Windows
```

### Verify Artifacts

```bash
# Check file sizes and contents
ls -la dist/
file dist/*

# Test installation
# Install and run on target platform
```

## 💡 Development Tips

### Quick Development Workflow

```bash
# 1. One-time setup
make setup

# 2. Daily development
make dev          # Start dev environment
# Make your changes...
make build        # Test build
make test         # Verify functionality

# 3. Before committing
make clean
make build-all    # Ensure all platforms work
```

### Debugging Builds

```bash
# Verbose output
npm run dist -- --publish=never --config.compression=store

# Debug specific platform
DEBUG=electron-builder npm run dist:linux

# Check binary compatibility
file binaries/whisper
ldd binaries/whisper  # Linux
otool -L binaries/whisper  # macOS
```

### Custom Build Configurations

Create `.env` file for custom settings:
```bash
# .env
WHISPER_MODEL_SIZE=base
INCLUDE_MODELS=tiny,base
BUILD_UNIVERSAL=true
CSC_LINK=path/to/certificate.p12
```

## 🔐 Code Signing & Notarization

### macOS Code Signing

```bash
# Set up signing certificate
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate-password"

# Enable signing
export CSC_IDENTITY_AUTO_DISCOVERY=true

# Build with signing
npm run dist:mac
```

### Windows Code Signing

```bash
# Set up certificate
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate-password"

# Build with signing
npm run dist:win
```

### Auto-updater Setup

```bash
# Configure in package.json publish section
"publish": {
  "provider": "github",
  "owner": "your-username",
  "repo": "whisperdesk-enhanced"
}
```

## 🌐 Distribution

### GitHub Releases

Automatically created via GitHub Actions:
- Triggers on version tags (`v*`)
- Uploads all platform artifacts
- Generates release notes from commits

### Alternative Distribution

**Direct Download:**
- Host artifacts on your own server
- Update `package.json` publish configuration

**Package Managers:**
```bash
# Homebrew (macOS)
brew install --cask whisperdesk-enhanced

# Chocolatey (Windows)
choco install whisperdesk-enhanced

# Snap (Linux)
snap install whisperdesk-enhanced

# Flatpak (Linux)
flatpak install whisperdesk-enhanced
```

## 📊 Analytics & Monitoring

### Build Analytics

Track build success rates:
```bash
# In GitHub Actions
- name: Report build status
  if: always()
  run: |
    curl -X POST https://your-analytics.com/build \
      -d "status=${{ job.status }}" \
      -d "platform=${{ matrix.platform }}"
```

### Crash Reporting

Configure crash reporting in production builds:
```javascript
// In main.js
if (process.env.NODE_ENV === 'production') {
  require('@sentry/electron').init({
    dsn: 'your-sentry-dsn'
  })
}
```

## 🔄 Continuous Integration

### Multi-Repository Setup

For organizations with multiple repositories:

```yaml
# .github/workflows/build-matrix.yml
strategy:
  matrix:
    include:
      - os: ubuntu-latest
        target: linux
        runs-on: self-hosted
      - os: windows-latest  
        target: windows
        runs-on: windows-builder
      - os: macos-latest
        target: macos
        runs-on: macos-builder
```

### Dependency Updates

Automated dependency updates:
```yaml
# .github/workflows/update-deps.yml
name: Update Dependencies
on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update dependencies
        run: |
          npm update
          cd src/renderer/whisperdesk-ui && pnpm update
      - name: Test build
        run: make build
```

## 🚀 Advanced Build Scenarios

### Building for Older Systems

```bash
# Target older macOS versions
export MACOSX_DEPLOYMENT_TARGET=10.13
npm run dist:mac

# Target older Linux distributions
export CC=gcc-8
export CXX=g++-8
make build-linux
```

### Custom whisper.cpp Builds

```bash
# Build with GPU acceleration
git clone https://github.com/ggerganov/whisper.cpp.git /tmp/whisper.cpp
cd /tmp/whisper.cpp
make WHISPER_CUBLAS=1  # CUDA
# or
make WHISPER_METAL=1   # Metal (macOS)
# or  
make WHISPER_OPENBLAS=1 # OpenBLAS
```

### Embedding Additional Models

```bash
# Download and include more models
mkdir -p models
curl -L -o models/ggml-base.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
curl -L -o models/ggml-small.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin

# Update package.json extraResources to include them
```

## 📝 Build Scripts Reference

### Available Scripts (package.json)

| Script | Description | Platform |
|--------|-------------|----------|
| `build:platform` | Auto-detect and build for current platform | All |
| `build:macos` | Build macOS app | macOS |
| `build:linux` | Build Linux packages | Linux |
| `build:windows` | Build Windows executable | Windows |
| `build:all-platforms` | Build for all platforms | All |
| `build:docker` | Build using Docker | All |
| `release:prepare` | Prepare release artifacts | All |
| `release:github` | Create GitHub release | All |

### Makefile Targets

| Target | Description |
|--------|-------------|
| `make setup` | Complete new developer setup |
| `make build` | Build for current platform |
| `make build-all` | Build for all platforms |
| `make test` | Run all tests |
| `make clean` | Clean build artifacts |
| `make info` | Show build information |

## 📚 Additional Resources

- **Electron Builder**: https://www.electron.build/
- **whisper.cpp**: https://github.com/ggerganov/whisper.cpp
- **GitHub Actions**: https://docs.github.com/en/actions
- **Docker Buildx**: https://docs.docker.com/buildx/
- **Code Signing Guide**: https://www.electron.build/code-signing
- **Auto-updater**: https://www.electron.build/auto-update

## 🤝 Contributing

### Setting Up Development Environment

```bash
# Fork and clone the repository
git clone https://github.com/your-username/whisperdesk-enhanced.git
cd whisperdesk-enhanced

# Set up development environment
make setup

# Create a feature branch
git checkout -b feature/your-feature

# Make changes and test
make dev
make test
make build

# Submit a pull request
```

### Build Testing Checklist

Before submitting a PR, ensure:

- [ ] All platforms build successfully
- [ ] Native tests pass (`make test-native`)
- [ ] Transcription tests pass (`make test-transcription`)
- [ ] No console errors in development
- [ ] App starts and basic functionality works
- [ ] File upload and transcription work
- [ ] Model download works

### Release Checklist

Before creating a release:

- [ ] Version bumped in `package.json`
- [ ] CHANGELOG.md updated
- [ ] All tests passing
- [ ] Documentation updated
- [ ] GitHub Actions build successful
- [ ] Artifacts tested on target platforms
- [ ] Release notes prepared

---

## 📞 Support

If you encounter build issues:

1. **Check the troubleshooting section** above
2. **Review the logs** for specific error messages
3. **Search existing issues** on GitHub
4. **Create a new issue** with:
   - Platform and architecture
   - Build command used
   - Complete error output
   - System information (`make info`)

---

*This build system is designed to be robust and cross-platform. The automated GitHub Actions pipeline ensures consistent builds across all platforms, while the local scripts provide flexibility for development and testing.*