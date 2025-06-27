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
      
      // Test basic import
      const cap = require('@firstform/caprecorder');
      console.log('✅ CapRecorder import successful');
      
    } catch (error) {
      console.error('❌ CapRecorder not found:', error.message);
      console.log('📝 Run: npm install @firstform/caprecorder');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ CapRecorder setup failed:', error.message);
    console.log('📝 CapRecorder provides unified cross-platform recording');
    throw error;
  }
}

// Run setup
setupPlatformSpecific()
  .then(() => {
    console.log('🚀 WhisperDesk ready with CapRecorder screen recording');
  })
  .catch((error) => {
    console.error('❌ Platform setup failed:', error);
    process.exit(1);
  });