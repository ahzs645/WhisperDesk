// scripts/setup-ffmpeg.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎵 Setting up FFmpeg for audio processing...');

async function setupFFmpeg() {
  try {
    // Method 1: Check if FFmpeg is already in PATH
    if (await checkSystemFFmpeg()) {
      console.log('✅ FFmpeg already available in system PATH');
      return;
    }
    
    // Method 2: Use bundled FFmpeg from ffmpeg-static
    if (await setupBundledFFmpeg()) {
      console.log('✅ Using bundled FFmpeg from ffmpeg-static');
      return;
    }
    
    // Method 3: Platform-specific installation guidance
    await providePlatformGuidance();
    
  } catch (error) {
    console.error('❌ FFmpeg setup failed:', error.message);
    throw error;
  }
}

async function checkSystemFFmpeg() {
  try {
    const output = execSync('ffmpeg -version', { stdio: 'pipe', encoding: 'utf8' });
    const version = output.split('\n')[0];
    console.log(`✅ System FFmpeg found: ${version}`);
    return true;
  } catch (error) {
    console.log('📝 FFmpeg not found in system PATH');
    return false;
  }
}

async function setupBundledFFmpeg() {
  try {
    // Check if ffmpeg-static is installed
    const ffmpegStatic = require('ffmpeg-static');
    
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      console.log(`✅ Bundled FFmpeg found: ${ffmpegStatic}`);
      
      // Test the bundled FFmpeg
      const output = execSync(`"${ffmpegStatic}" -version`, { stdio: 'pipe', encoding: 'utf8' });
      const version = output.split('\n')[0];
      console.log(`✅ Bundled FFmpeg version: ${version}`);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('📝 ffmpeg-static not available, installing...');
    
    try {
      // Install ffmpeg-static
      execSync('npm install ffmpeg-static --save', { stdio: 'inherit' });
      console.log('✅ ffmpeg-static installed successfully');
      
      // Test again
      const ffmpegStatic = require('ffmpeg-static');
      if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
        console.log(`✅ Bundled FFmpeg ready: ${ffmpegStatic}`);
        return true;
      }
    } catch (installError) {
      console.error('❌ Failed to install ffmpeg-static:', installError.message);
    }
    
    return false;
  }
}

async function providePlatformGuidance() {
  const platform = process.platform;
  
  console.log('\n⚠️ FFmpeg not available. Platform-specific installation:');
  
  switch (platform) {
    case 'darwin':
      console.log('🍎 macOS:');
      console.log('   • Install via Homebrew: brew install ffmpeg');
      console.log('   • Or download from: https://ffmpeg.org/download.html');
      break;
      
    case 'win32':
      console.log('🪟 Windows:');
      console.log('   • Download from: https://ffmpeg.org/download.html');
      console.log('   • Or install via Chocolatey: choco install ffmpeg');
      console.log('   • Or install via Winget: winget install ffmpeg');
      break;
      
    case 'linux':
      console.log('🐧 Linux:');
      console.log('   • Ubuntu/Debian: sudo apt install ffmpeg');
      console.log('   • CentOS/RHEL: sudo yum install ffmpeg');
      console.log('   • Arch: sudo pacman -S ffmpeg');
      break;
      
    default:
      console.log('📦 Generic: Download from https://ffmpeg.org/download.html');
  }
  
  console.log('\n💡 Alternative: The app will use bundled ffmpeg-static if available');
  console.log('💡 For best performance, install system FFmpeg');
}

async function testFFmpeg() {
  console.log('\n🧪 Testing FFmpeg functionality...');
  
  try {
    // Test system FFmpeg
    let ffmpegPath = 'ffmpeg';
    try {
      execSync('ffmpeg -version', { stdio: 'pipe' });
      console.log('✅ System FFmpeg test passed');
    } catch (error) {
      // Try bundled FFmpeg
      try {
        const ffmpegStatic = require('ffmpeg-static');
        ffmpegPath = ffmpegStatic;
        execSync(`"${ffmpegPath}" -version`, { stdio: 'pipe' });
        console.log('✅ Bundled FFmpeg test passed');
      } catch (bundledError) {
        throw new Error('No working FFmpeg found');
      }
    }
    
    // Test audio processing capabilities
    console.log('🎵 Testing audio processing capabilities...');
    
    const testCommand = `"${ffmpegPath}" -f lavfi -i "sine=frequency=1000:duration=1" -f null -`;
    execSync(testCommand, { stdio: 'pipe' });
    console.log('✅ Audio processing test passed');
    
    // Test codec support
    console.log('🎬 Checking codec support...');
    const codecsOutput = execSync(`"${ffmpegPath}" -codecs`, { stdio: 'pipe', encoding: 'utf8' });
    
    const supportedCodecs = {
      'h264': codecsOutput.includes('h264'),
      'aac': codecsOutput.includes('aac'),
      'opus': codecsOutput.includes('opus'),
      'vp8': codecsOutput.includes('vp8'),
      'vp9': codecsOutput.includes('vp9')
    };
    
    console.log('✅ Codec support:');
    Object.entries(supportedCodecs).forEach(([codec, supported]) => {
      console.log(`   ${supported ? '✅' : '❌'} ${codec.toUpperCase()}`);
    });
    
    console.log('\n🎉 FFmpeg is ready for audio/video processing!');
    
  } catch (error) {
    console.error('❌ FFmpeg test failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  setupFFmpeg()
    .then(() => testFFmpeg())
    .then(() => {
      console.log('✅ FFmpeg setup and test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ FFmpeg setup failed:', error.message);
      process.exit(1);
    });
}

module.exports = { setupFFmpeg, testFFmpeg };