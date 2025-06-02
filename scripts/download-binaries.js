const fs = require('fs');
const path = require('path');
const https = require('https');

const BINARIES_DIR = path.join(__dirname, '../binaries');
const WHISPER_CPP_VERSION = 'v1.5.4';

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

  for (const [platform, url] of Object.entries(DOWNLOAD_URLS)) {
    console.log(`Downloading ${platform}...`);
    const outputPath = path.join(BINARIES_DIR, `whisper-${platform}.zip`);
    
    try {
      await downloadFile(url, outputPath);
      console.log(`✅ Downloaded ${platform}`);
    } catch (error) {
      console.error(`❌ Failed to download ${platform}:`, error.message);
    }
  }
  
  console.log('🎉 Binary download complete!');
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

