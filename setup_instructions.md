# Setting Up the WhisperDesk Build Pipeline

This guide walks you through setting up the complete build pipeline for WhisperDesk Enhanced.

## 🚀 Quick Setup

### 1. Copy Build Files to Your Project

```bash
# Copy all the build files to your project root
cp github_actions_pipeline.yml .github/workflows/build.yml
cp build_scripts_collection.sh scripts/build-all.sh
cp platform_specific_scripts.sh scripts/build-macos.sh
cp platform_specific_scripts.sh scripts/build-linux.sh
cp platform_specific_scripts.ps1 scripts/build-windows.ps1
cp makefile_build_system Makefile
cp docker_build_setup.dockerfile Dockerfile.linux
cp package_json_updates.json package.json  # Merge with your existing package.json
```

### 2. Make Scripts Executable

```bash
chmod +x scripts/*.sh
chmod +x Makefile
```

### 3. Test Local Build

```bash
# Quick test
make setup
make build
```

## 📁 File Structure

After setup, your project should have:

```
WhisperDesk/
├── .github/
│   └── workflows/
│       └── build.yml                 # GitHub Actions pipeline
├── scripts/
│   ├── build-all.sh                  # Master build script
│   ├── build-macos.sh               # macOS build
│   ├── build-linux.sh               # Linux build
│   ├── build-windows.ps1            # Windows build
│   ├── build-universal.sh           # Auto-detect platform
│   ├── docker-build.sh              # Docker builds
│   └── setup-docker-buildx.sh       # Docker setup
├── Dockerfile.linux                 # Linux Docker build
├── Dockerfile.windows              # Windows Docker build  
├── docker-compose.yml              # Multi-platform Docker
├── Makefile                         # Build automation
├── package.json                     # Updated with build scripts
└── BUILD.md                         # Build documentation
```

## 🔧 Configuration Steps

### 1. Update package.json

Merge the enhanced build scripts into your existing `package.json`:

```json
{
  "scripts": {
    "build:platform": "chmod +x scripts/build-universal.sh && ./scripts/build-universal.sh",
    "build:macos": "chmod +x scripts/build-macos.sh && ./scripts/build-macos.sh",
    "build:linux": "chmod +x scripts/build-linux.sh && ./scripts/build-linux.sh", 
    "build:windows": "powershell -ExecutionPolicy Bypass -File scripts/build-windows.ps1",
    "build:all-platforms": "chmod +x scripts/build-all.sh && ./scripts/build-all.sh all",
    "build:docker": "chmod +x scripts/docker-build.sh && ./scripts/docker-build.sh"
  }
}
```

### 2. GitHub Actions Setup

1. **Enable GitHub Actions** in your repository settings
2. **Add repository secrets** (if using code signing):
   ```
   CSC_LINK          # Certificate file (base64 encoded)
   CSC_KEY_PASSWORD  # Certificate password
   GITHUB_TOKEN      # Automatically provided
   ```

3. **Push to trigger** the first build:
   ```bash
   git add .
   git commit -m "Add build pipeline"
   git push
   ```

### 3. Docker Setup (Optional)

If using Docker builds:

```bash
# Install Docker BuildX
docker buildx create --name whisperdesk-builder --use --bootstrap

# Build using Docker
make docker-build
```

## 🏗️ Build Methods

### Method 1: GitHub Actions (Recommended)

**Pros:** 
- Fully automated
- Builds all platforms
- Consistent environment
- Free for public repos

**Trigger builds by:**
- Pushing to `main` or `release` branches
- Creating version tags (`v1.0.0`)
- Manual workflow dispatch

### Method 2: Local Scripts

**Pros:**
- Fast iteration
- Full control
- Works offline

**Usage:**
```bash
# Auto-detect platform
./scripts/build-universal.sh

# Specific platform
./scripts/build-macos.sh      # macOS
./scripts/build-linux.sh      # Linux  
powershell scripts/build-windows.ps1  # Windows

# All platforms (works best on macOS)
./scripts/build-all.sh all
```

### Method 3: Makefile

**Pros:**
- Standardized interface
- Dependency management
- Cross-platform

**Usage:**
```bash
make help          # Show all targets
make setup         # New developer setup
make build         # Build current platform
make build-all     # Build all platforms
make test          # Run tests
```

### Method 4: Docker

**Pros:**
- Isolated environment
- Reproducible builds
- Multi-platform support

**Usage:**
```bash
make docker-setup  # One-time setup
make docker-build  # Build with Docker
```

## 🧪 Testing the Pipeline

### 1. Local Testing

```bash
# Test each build method
make setup                    # Setup dependencies
make build                    # Local build
./scripts/build-universal.sh  # Script build
make docker-build            # Docker build (if Docker installed)
```

### 2. GitHub Actions Testing

```bash
# Create a test tag to trigger builds
git tag v0.0.1-test
git push origin v0.0.1-test

# Check Actions tab in GitHub for build status
```

### 3. Verify Outputs

```bash
# Check build artifacts
ls -la dist/

# Test the built app
./dist/WhisperDesk-Enhanced-*  # Linux
open dist/*.dmg               # macOS  
dist/*.exe                    # Windows
```

## 🚨 Troubleshooting

### Common Issues

**1. Scripts not executable:**
```bash
chmod +x scripts/*.sh
```

**2. Node.js version issues:**
```bash
# Use Node 18+
nvm install 18
nvm use 18
```

**3. Missing build dependencies:**
```bash
# macOS
xcode-select --install
brew install cmake

# Linux
sudo apt-get install build-essential cmake

# Windows
choco install visualstudio2022buildtools cmake
```

**4. GitHub Actions failing:**
- Check the Actions logs in GitHub
- Ensure all required files are committed
- Verify workflow file syntax

**5. Docker build issues:**
```bash
# Reset Docker BuildX
docker buildx rm whisperdesk-builder
docker buildx create --name whisperdesk-builder --use --bootstrap
```

### Platform-Specific Issues

**macOS:**
- Disable code signing: `export CSC_IDENTITY_AUTO_DISCOVERY=false`
- Install Xcode Command Line Tools
- May need Rosetta 2 on Apple Silicon

**Linux:**
- Install FUSE for AppImage: `sudo apt install fuse`
- Missing ALSA libraries: `sudo apt install libasound2-dev`
- Permission issues: Use `sudo` for system packages

**Windows:**
- PowerShell execution policy: `Set-ExecutionPolicy RemoteSigned`
- Visual Studio Build Tools required
- Antivirus may block builds

## 📊 Build Performance

### Expected Times

| Method | Platform | Clean Build | Incremental |
|--------|----------|-------------|-------------|
| Local | macOS M1 | 8-12 min | 2-4 min |
| Local | Linux | 10-15 min | 3-5 min |
| Local | Windows | 12-18 min | 4-6 min |
| GitHub Actions | All | 15-25 min | N/A |
| Docker | All | 20-30 min | 5-10 min |

### Optimization Tips

1. **Use parallel builds:** `make -j$(nproc)`
2. **Cache dependencies** in CI/CD
3. **Use incremental builds** for development
4. **Build only changed platforms**
5. **Use pnpm** instead of npm

## 🔄 Release Workflow

### Automated Release

```bash
# 1. Update version
npm version patch  # or minor, major

# 2. Push with tags
git push && git push --tags

# 3. GitHub Actions automatically:
#    - Builds all platforms
#    - Creates GitHub release
#    - Uploads artifacts
```

### Manual Release

```bash
# 1. Build all platforms
make build-all

# 2. Create release manually
gh release create v1.0.0 dist/* --generate-notes
```

## 📋 Maintenance

### Regular Updates

```bash
# Update whisper.cpp
rm -rf binaries
make build-whisper

# Update dependencies
npm update
cd src/renderer/whisperdesk-ui && pnpm update

# Test after updates
make test
make build
```

### Monitoring

- **GitHub Actions**: Check build success rates
- **Dependencies**: Monitor for security updates
- **Platform compatibility**: Test on target systems

## 🎯 Next Steps

1. **Test the pipeline** on your specific project
2. **Customize build scripts** for your needs  
3. **Set up code signing** for distribution
4. **Configure auto-updates** for users
5. **Add crash reporting** for production

## 📞 Getting Help

If you encounter issues:

1. Check the [BUILD.md](BUILD.md) troubleshooting section
2. Review GitHub Actions logs
3. Test locally with verbose output
4. Create an issue with full error logs

---

*This pipeline provides a robust, automated build system that works across all platforms. The GitHub Actions workflow ensures consistent builds, while local scripts provide flexibility for development.*