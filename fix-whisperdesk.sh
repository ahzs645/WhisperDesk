#!/bin/bash

# WhisperDesk Enhanced - Quick Fix Script
# Automatically resolves common issues with transcription and model selection

set -e  # Exit on any error

echo "🔧 WhisperDesk Enhanced - Quick Fix Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Environment Check
print_status "Checking environment..."

if ! command_exists node; then
    print_error "Node.js not found. Please install Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_warning "Node.js version is $NODE_VERSION. Recommended: 18+"
fi

# 2. Build Frontend
print_status "Building frontend..."
cd src/renderer/whisperdesk-ui

# Install pnpm if not available
if ! command_exists pnpm; then
    print_status "Installing pnpm..."
    npm install -g pnpm
fi

# Build frontend
pnpm run build || { print_error "Frontend build failed"; exit 1; }

cd ../../..

# 3. Install Python Dependencies
print_status "Checking Python dependencies..."

if command_exists python3; then
    print_status "Installing Python Whisper..."
    pip3 install openai-whisper torch torchaudio || print_warning "Python Whisper installation failed"
else
    print_warning "Python3 not found. Install Python 3.8+ and run: pip3 install openai-whisper"
fi

# 4. Create Enhanced Transcription Service
print_status "Creating enhanced transcription service..."

cat > src/main/services/transcription-service-enhanced.js << 'EOF'
const TranscriptionService = require('./transcription-service');
const { EventEmitter } = require('events');

class EnhancedTranscriptionService extends EventEmitter {
  constructor(modelManager) {
    super();
    this.transcriptionService = new TranscriptionService(modelManager);
    this.setupEventForwarding();
  }

  async initialize() {
    return this.transcriptionService.initialize();
  }

  setupEventForwarding() {
    // Forward all events from the base service
    this.transcriptionService.on('transcription:progress', (data) => {
      console.log('Transcription progress:', data);
      this.emit('progress', data);
    });

    this.transcriptionService.on('transcription:complete', (data) => {
      console.log('Transcription complete:', data);
      this.emit('complete', data);
    });

    this.transcriptionService.on('transcription:error', (data) => {
      console.error('Transcription error:', data);
      this.emit('error', data);
    });
  }

  async processFile(filePath, options = {}) {
    const transcriptionId = `tx_${Date.now()}`;
    
    try {
      // Emit start event
      this.emit('progress', { 
        transcriptionId, 
        stage: 'starting', 
        progress: 0,
        message: 'Initializing transcription...' 
      });

      // Add progress tracking wrapper
      const enhancedOptions = {
        ...options,
        transcriptionId,
        onProgress: (progress) => {
          this.emit('progress', { transcriptionId, ...progress });
        }
      };

      const result = await this.transcriptionService.processFile(filePath, enhancedOptions);
      
      // Emit completion
      this.emit('complete', { transcriptionId, result });
      
      return result;
    } catch (error) {
      this.emit('error', { transcriptionId, error: error.message });
      throw error;
    }
  }

  getProviders() {
    return this.transcriptionService.getProviders();
  }
}

module.exports = EnhancedTranscriptionService;
EOF

# 5. Download Initial Model
print_status "Ensuring at least one model is available..."

if [ -f "download-tiny-model.js" ]; then
    node download-tiny-model.js || print_warning "Model download failed, but continuing..."
else
    print_warning "Model download script not found"
fi

# 6. Create Startup Script with Debug
print_status "Creating enhanced startup script..."

cat > start-debug.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting WhisperDesk Enhanced with Debug Mode"
echo "================================================"

# Set debug environment variables
export DEBUG=whisperdesk:*
export NODE_ENV=development
export ELECTRON_ENABLE_LOGGING=1

# Check if everything is ready
echo "Pre-flight checks:"

# Check if frontend is built
if [ ! -d "src/renderer/whisperdesk-ui/dist" ]; then
    echo "❌ Frontend not built. Building now..."
    cd src/renderer/whisperdesk-ui
    pnpm run build
    cd ../../..
fi

# Check if models are available
echo "📋 Testing services..."
node test-services.js

echo ""
echo "🎙️ Starting application..."
npm run dev
EOF

chmod +x start-debug.sh

# 7. Final Verification
print_status "Running final verification..."

# Test services
if node test-services.js > /dev/null 2>&1; then
    print_success "Backend services are working"
else
    print_warning "Backend services test failed"
fi

# Check frontend build
if [ -d "src/renderer/whisperdesk-ui/dist" ]; then
    print_success "Frontend build exists"
else
    print_warning "Frontend build missing"
fi

echo ""
print_success "Quick fix completed!"
echo ""
echo "🚀 Next Steps:"
echo "=============="
echo "1. Test the fixes:"
echo "   node test-services.js"
echo ""
echo "2. Start the application:"
echo "   ./start-debug.sh    # Debug mode with logging"
echo "   npm run dev         # Normal mode"
echo ""
echo "3. If issues persist, run diagnostics:"
echo "   node diagnostic.js"
echo ""
print_status "Check the console for any error messages and ensure file upload shows progress indicators"

