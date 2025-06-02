const fs = require('fs');
const path = require('path');
const https = require('https');

const BINARIES_DIR = path.join(__dirname, '../binaries');
const WHISPER_CPP_VERSION = 'v1.5.4';

// Note: These URLs are placeholders as the actual whisper.cpp releases
// don't provide pre-built binaries. You'll need to build from source.
const DOWNLOAD_URLS = {
  'win32-x64': `https://github.com/ggerganov/whisper.cpp/releases/download/${WHISPER_CPP_VERSION}/whisper-bin-win32.zip`,
  'darwin-x64': `https://github.com/ggerganov/whisper.cpp/releases/download/${WHISPER_CPP_VERSION}/whisper-bin-x64.zip`,
  'darwin-arm64': `https://github.com/ggerganov/whisper.cpp/releases/download/${WHISPER_CPP_VERSION}/whisper-bin-arm64.zip`,
  'linux-x64': `https://github.com/ggerganov/whisper.cpp/releases/download/${WHISPER_CPP_VERSION}/whisper-bin-Linux.zip`
};

async function downloadBinaries() {
  console.log('📥 Downloading whisper.cpp binaries...');
  
  if (!fs.existsSync(BINARIES_DIR)) {
    fs.mkdirSync(BINARIES_DIR, { recursive: true });
  }

  // Check if we already have a working binary
  const existingBinary = path.join(BINARIES_DIR, 'whisper');
  if (fs.existsSync(existingBinary)) {
    console.log('✅ Whisper binary already exists, skipping download');
    console.log('🎉 Binary setup complete!');
    return;
  }

  let downloadedAny = false;

  for (const [platform, url] of Object.entries(DOWNLOAD_URLS)) {
    console.log(`Downloading ${platform}...`);
    const outputPath = path.join(BINARIES_DIR, `whisper-${platform}.zip`);
    
    try {
      await downloadFile(url, outputPath);
      console.log(`✅ Downloaded ${platform}`);
      downloadedAny = true;
    } catch (error) {
      if (error.message.includes('404')) {
        console.log(`❌ Failed to download ${platform}: HTTP 404: Not Found`);
      } else {
        console.error(`❌ Failed to download ${platform}:`, error.message);
      }
    }
  }
  
  console.log('🎉 Binary download complete!');
  
  if (!downloadedAny) {
    console.log('');
    console.log('⚠️  No pre-built binaries are available from whisper.cpp releases.');
    console.log('📋 To set up whisper.cpp, choose one of these options:');
    console.log('');
    console.log('Option 1: Use the included binary (Linux only):');
    console.log('   chmod +x ./binaries/whisper');
    console.log('');
    console.log('Option 2: Build from source (all platforms):');
    console.log('   # Install build dependencies (Ubuntu/Debian):');
    console.log('   sudo apt-get install -y build-essential cmake');
    console.log('');
    console.log('   # Clone and build whisper.cpp:');
    console.log('   git clone https://github.com/ggerganov/whisper.cpp.git /tmp/whisper.cpp');
    console.log('   cd /tmp/whisper.cpp');
    console.log('   make -j$(nproc)');
    console.log('   cp build/bin/whisper-cli ./binaries/whisper');
    console.log('   chmod +x ./binaries/whisper');
    console.log('');
    console.log('Option 3: Skip binary setup for now:');
    console.log('   # You can run the web interface without the binary');
    console.log('   # Just start the development server:');
    console.log('   npm run dev:renderer');
    console.log('');
  }
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(outputPath, () => {});
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (error) => {
        file.close();
        fs.unlink(outputPath, () => {});
        reject(error);
      });
    }).on('error', (error) => {
      file.close();
      fs.unlink(outputPath, () => {});
      reject(error);
    });
  });
}

if (require.main === module) {
  downloadBinaries().catch(console.error);
}

module.exports = { downloadBinaries };

