// scripts/setup-platform-specific.js
const os = require('os');
const { execSync } = require('child_process');

console.log('🔧 Setting up platform-specific features...');

async function setupPlatformSpecific() {
  const platform = process.platform;
  const arch = process.arch;
  
  console.log(`Platform: ${platform} (${arch})`);
  
  // CapRecorder handles all platform-specific recording needs
  await setupCapRecorder();
  
  console.log('✅ Platform-specific setup completed');
  console.log('📝 Screen recording powered by CapRecorder');
}

async function setupCapRecorder() {
  try {
    console.log('📦 Verifying CapRecorder installation...');
    
    // Check if CapRecorder is installed
    try {
      require.resolve('@firstform/caprecorder');
      console.log('✅ CapRecorder is available');
      
      // Test basic import - this may fail in CI environments
      try {
        const cap = require('@firstform/caprecorder');
        console.log('✅ CapRecorder import successful');
      } catch (importError) {
        console.warn('⚠️ CapRecorder import failed (this is expected in CI environments):', importError.message);
        
        // In CI or environments where native modules aren't available,
        // we'll use fallback recording methods
        if (process.env.CI || process.env.GITHUB_ACTIONS) {
          console.log('🔧 CI environment detected - CapRecorder will use runtime fallbacks');
          return; // Don't fail in CI
        }
        
        // For local development, try to install the missing platform package
        const platform = process.platform;
        const arch = process.arch;
        const platformPackage = getPlatformPackageName(platform, arch);
        
        if (platformPackage) {
          console.log(`📦 Attempting to install missing platform package: ${platformPackage}`);
          try {
            execSync(`npm install ${platformPackage}`, { stdio: 'inherit' });
            console.log('✅ Platform package installed successfully');
            
            // Try import again
            const cap = require('@firstform/caprecorder');
            console.log('✅ CapRecorder import successful after package installation');
          } catch (installError) {
            console.warn('⚠️ Could not install platform package automatically:', installError.message);
            console.log('📝 Manual installation may be required for optimal functionality');
          }
        } else {
          console.warn('⚠️ Unknown platform/arch combination, falling back to alternative recording methods');
        }
      }
      
    } catch (error) {
      console.error('❌ CapRecorder package not found:', error.message);
      console.log('📝 Run: npm install @firstform/caprecorder');
      
      // Don't fail in CI environments
      if (process.env.CI || process.env.GITHUB_ACTIONS) {
        console.log('🔧 CI environment detected - continuing without CapRecorder');
        return;
      }
      
      throw error;
    }
    
  } catch (error) {
    console.error('❌ CapRecorder setup failed:', error.message);
    console.log('📝 CapRecorder provides unified cross-platform recording');
    
    // Don't fail in CI environments
    if (process.env.CI || process.env.GITHUB_ACTIONS) {
      console.log('🔧 CI environment detected - continuing without CapRecorder');
      return;
    }
    
    throw error;
  }
}

function getPlatformPackageName(platform, arch) {
  const packages = {
    'win32-x64': '@firstform/caprecorder-win32-x64-msvc',
    'darwin-x64': '@firstform/caprecorder-darwin-x64',
    'darwin-arm64': '@firstform/caprecorder-darwin-arm64',
    'linux-x64': '@firstform/caprecorder-linux-x64-gnu',
    'linux-arm64': '@firstform/caprecorder-linux-arm64-gnu'
  };
  
  return packages[`${platform}-${arch}`];
}

// Run setup
setupPlatformSpecific()
  .then(() => {
    console.log('🚀 WhisperDesk ready with CapRecorder screen recording');
  })
  .catch((error) => {
    console.error('❌ Platform setup failed:', error);
    
    // In CI environments, don't fail the build
    if (process.env.CI || process.env.GITHUB_ACTIONS) {
      console.log('🔧 CI environment detected - continuing build despite platform setup issues');
      console.log('📝 Platform-specific features may not be available in CI builds');
      process.exit(0); // Exit successfully
    } else {
      process.exit(1);
    }
  });