// scripts/setup-platform-specific.js
const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up platform-specific features...');

async function setupPlatformSpecific() {
  const platform = process.platform;
  const arch = process.arch;
  
  console.log(`Platform: ${platform} (${arch})`);
  
  switch (platform) {
    case 'darwin':
      await setupMacOS();
      break;
    case 'win32':
      await setupWindows();
      break;
    case 'linux':
      await setupLinux();
      break;
    default:
      console.log('⚠️ Unknown platform, using defaults');
  }
}

async function setupMacOS() {
  console.log('🍎 Setting up macOS-specific features...');
  
  // Check macOS version
  const version = getMacOSVersion();
  console.log(`macOS version: ${version}`);
  
  if (version >= 13) {
    console.log('✅ macOS 13+ detected - ScreenCaptureKit available');
    await setupAperture();
  } else {
    console.log('⚠️ macOS version too old for ScreenCaptureKit');
    console.log('   Falling back to browser-based recording');
  }
  
  await setupFFmpeg();
}

async function setupAperture() {
  try {
    console.log('📦 Installing Aperture for ScreenCaptureKit support...');
    
    // Check if already installed
    try {
      require.resolve('aperture');
      console.log('✅ Aperture already installed');
      return;
    } catch (error) {
      // Not installed, continue
    }
    
    // Install Aperture
    execSync('npm install aperture@latest --save-optional', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log('✅ Aperture installed successfully');
    
    // Test Aperture installation
    await testAperture();
    
  } catch (error) {
    console.error('❌ Failed to install Aperture:', error.message);
    console.log('📝 This is optional - app will use browser recording instead');
  }
}

async function testAperture() {
  try {
    console.log('🧪 Testing Aperture installation...');
    
    const testScript = `
const Aperture = require('aperture');

async function test() {
  try {
    const screens = await Aperture.Devices.screen();
    console.log('✅ Aperture test passed:', screens.length, 'screens found');
  } catch (error) {
    console.error('❌ Aperture test failed:', error.message);
    process.exit(1);
  }
}

test();
`;
    
    const tempPath = path.join(os.tmpdir(), 'aperture-test.js');
    fs.writeFileSync(tempPath, testScript);
    
    execSync(`node ${tempPath}`, { stdio: 'inherit' });
    
    fs.unlinkSync(tempPath);
    console.log('✅ Aperture test completed successfully');
    
  } catch (error) {
    console.error('❌ Aperture test failed:', error.message);
    throw error;
  }
}

async function setupFFmpeg() {
  try {
    console.log('🎵 Setting up FFmpeg for audio processing...');
    
    // Check if FFmpeg is already available
    try {
      execSync('ffmpeg -version', { stdio: 'pipe' });
      console.log('✅ FFmpeg already available in PATH');
      return;
    } catch (error) {
      // Not in PATH, check if bundled
    }
    
    // Use bundled FFmpeg from ffmpeg-static
    try {
      const ffmpegStatic = require('ffmpeg-static');
      console.log('✅ Using bundled FFmpeg:', ffmpegStatic);
    } catch (error) {
      console.error('❌ FFmpeg not available:', error.message);
      console.log('📝 Install FFmpeg manually or via: brew install ffmpeg');
    }
    
  } catch (error) {
    console.error('❌ FFmpeg setup failed:', error.message);
  }
}

async function setupWindows() {
  console.log('🪟 Setting up Windows-specific features...');
  console.log('ℹ️ Using browser-based recording (recommended for Windows)');
  
  // Windows will use browser recording method
  await setupFFmpeg();
}

async function setupLinux() {
  console.log('🐧 Setting up Linux-specific features...');
  console.log('ℹ️ Using browser-based recording (recommended for Linux)');
  
  // Linux will use browser recording method
  await setupFFmpeg();
}

function getMacOSVersion() {
  try {
    const release = os.release();
    const parts = release.split('.');
    const major = parseInt(parts[0]);
    
    // Convert Darwin version to macOS version
    // Darwin 22.x = macOS 13, Darwin 21.x = macOS 12, etc.
    return major - 9;
  } catch (error) {
    console.warn('Could not determine macOS version:', error);
    return 0;
  }
}

// Run setup
setupPlatformSpecific()
  .then(() => {
    console.log('✅ Platform-specific setup completed');
  })
  .catch((error) => {
    console.error('❌ Platform setup failed:', error);
    process.exit(1);
  });