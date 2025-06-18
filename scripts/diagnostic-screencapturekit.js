// diagnostic-screencapturekit.js
/**
 * Diagnostic script to test ScreenCaptureKit functionality
 * Run with: node diagnostic-screencapturekit.js
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

async function testApertureAPI() {
  console.log('\n📦 Testing Aperture API Structure:');
  
  try {
    const aperture = await import('aperture');
    
    console.log('Module structure:');
    console.log('- exports:', Object.keys(aperture));
    console.log('- recorder type:', typeof aperture.recorder);
    console.log('- recorder is object:', typeof aperture.recorder === 'object');
    console.log('- screens function:', typeof aperture.screens === 'function');
    console.log('- audioDevices function:', typeof aperture.audioDevices === 'function');
    
    // Test function calls
    if (typeof aperture.screens === 'function') {
      try {
        const screens = await aperture.screens();
        console.log('✅ screens() works, found:', screens.length);
      } catch (error) {
        console.error('❌ screens() failed:', error.message);
      }
    }
    
    // Test recorder object (NOT function)
    if (aperture.recorder && typeof aperture.recorder === 'object') {
      console.log('\n🧪 Testing recorder object...');
      
      const recorder = aperture.recorder;
      console.log('✅ Recorder object available');
      console.log('- recorder type:', typeof recorder);
      console.log('- has startRecording:', typeof recorder.startRecording === 'function');
      console.log('- has stopRecording:', typeof recorder.stopRecording === 'function');
      console.log('- has pause:', typeof recorder.pause === 'function');
      console.log('- has resume:', typeof recorder.resume === 'function');
      
      // List all methods
      const methods = Object.getOwnPropertyNames(recorder).filter(name => 
        typeof recorder[name] === 'function'
      );
      console.log('- available methods:', methods.join(', '));
      
    } else {
      console.log('❌ recorder is not an object');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Aperture API test failed:', error.message);
    return false;
  }
}

async function runDiagnostics() {
  console.log('🔍 ScreenCaptureKit Diagnostic Tool');
  console.log('=' .repeat(50));
  
  try {
    // 1. System Information
    console.log('\n📋 System Information:');
    console.log(`Platform: ${process.platform}`);
    console.log(`Architecture: ${process.arch}`);
    console.log(`Node.js: ${process.version}`);
    
    if (process.platform === 'darwin') {
      const release = os.release();
      const major = parseInt(release.split('.')[0]);
      const macOSVersion = major - 9;
      console.log(`macOS Version: ${macOSVersion} (Darwin ${major})`);
      
      if (macOSVersion < 13) {
        console.error('❌ ScreenCaptureKit requires macOS 13+ (Ventura or later)');
        return;
      } else {
        console.log('✅ macOS version compatible with ScreenCaptureKit');
      }
    } else {
      console.error('❌ ScreenCaptureKit only available on macOS');
      return;
    }

    // 2. Check Aperture Installation
    console.log('\n📦 Aperture Installation:');
    try {
      const aperture = await import('aperture');
      console.log('✅ Aperture v7 imported successfully');
      
      // Check available functions
      console.log(`Functions available: screens=${!!aperture.screens}, audioDevices=${!!aperture.audioDevices}`);
      
    } catch (error) {
      console.error('❌ Failed to import Aperture:', error.message);
      
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        console.log('\n💡 Solution: Install Aperture v7');
        console.log('npm install aperture@7');
        return;
      }
    }

    // 3. Test Aperture API Structure
    const apiOk = await testApertureAPI();
    if (!apiOk) {
      console.log('\n💡 Possible solutions:');
      console.log('1. Reinstall Aperture: npm uninstall aperture && npm install aperture@7');
      console.log('2. Check Node.js version (requires 16+)');
      console.log('3. Check if running with proper permissions');
      return;
    }

    // 4. Test Screen Enumeration
    console.log('\n🖥️ Screen Enumeration Test:');
    try {
      const aperture = await import('aperture');
      const screens = await aperture.screens();
      
      console.log(`✅ Found ${screens.length} screen(s):`);
      screens.forEach((screen, index) => {
        console.log(`  ${index + 1}. ${screen.name || 'Unnamed'} (ID: ${screen.id})`);
      });
      
      if (screens.length === 0) {
        console.error('❌ No screens available for recording');
        return;
      }
      
    } catch (error) {
      console.error('❌ Screen enumeration failed:', error.message);
      return;
    }

    // 5. Test Audio Device Enumeration
    console.log('\n🎤 Audio Device Test:');
    try {
      const aperture = await import('aperture');
      const audioDevices = await aperture.audioDevices();
      
      console.log(`✅ Found ${audioDevices.length} audio device(s):`);
      audioDevices.forEach((device, index) => {
        console.log(`  ${index + 1}. ${device.name || 'Unnamed'} (ID: ${device.id})`);
      });
      
    } catch (error) {
      console.warn('⚠️ Audio device enumeration failed:', error.message);
      console.log('   This is not critical for basic recording');
    }

    // 6. Test Recording Creation
    console.log('\n🎬 Recording Creation Test:');
    try {
      const aperture = await import('aperture');
      const screens = await aperture.screens();
      
      console.log(`Test will use screen: ${screens[0].name} (ID: ${screens[0].id})`);
      
      // Test recorder object usage - the CORRECT API
      if (aperture.recorder && typeof aperture.recorder === 'object') {
        console.log('✅ Using aperture.recorder object');
        
        const recorder = aperture.recorder;
        console.log('✅ Recorder object available');
        console.log(`Available methods: ${Object.getOwnPropertyNames(recorder).filter(name => typeof recorder[name] === 'function').join(', ')}`);
        
        // Test configuration that will be passed to startRecording()
        const testConfig = {
          screenId: screens[0].id,
          fps: 15,
          showCursor: true
        };
        
        console.log('✅ Test configuration created:', testConfig);
        console.log('✅ Ready to call recorder.startRecording(config)');
        
      } else {
        throw new Error('aperture.recorder is not an object');
      }
      
    } catch (error) {
      console.error('❌ Recording creation test failed:', error.message);
      console.log('\n💡 This error suggests the API usage needs to be fixed in your code');
      return;
    }

    // 7. Test Permissions (if running in Electron context)
    console.log('\n🔐 Permission Test:');
    try {
      const { systemPreferences } = require('electron');
      
      const screenPermission = systemPreferences.getMediaAccessStatus('screen');
      console.log(`Screen recording permission: ${screenPermission}`);
      
      const micPermission = systemPreferences.getMediaAccessStatus('microphone');
      console.log(`Microphone permission: ${micPermission}`);
      
      if (screenPermission !== 'granted') {
        console.warn('⚠️ Screen recording permission not granted');
        console.log('   Go to: System Settings > Privacy & Security > Screen Recording');
      }
      
    } catch (error) {
      console.log('ℹ️ Permission check skipped (not running in Electron context)');
    }

    // 8. Test File System Operations
    console.log('\n📁 File System Test:');
    try {
      const testDir = path.join(os.tmpdir(), 'whisperdesk-test');
      await fs.mkdir(testDir, { recursive: true });
      console.log('✅ Directory creation works');
      
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');
      console.log('✅ File writing works');
      
      const content = await fs.readFile(testFile, 'utf8');
      console.log('✅ File reading works');
      
      await fs.unlink(testFile);
      await fs.rmdir(testDir);
      console.log('✅ File cleanup works');
      
    } catch (error) {
      console.error('❌ File system test failed:', error.message);
    }

    // 9. Suggested Next Steps
    console.log('\n🎯 Diagnostic Summary:');
    console.log('✅ All basic tests passed!');
    console.log('\nNext steps:');
    console.log('1. Apply the fixed MacOSScreenCaptureRecorder.js');
    console.log('2. Ensure permissions are granted in System Settings');
    console.log('3. Test with a short recording');

    console.log('\n✅ Diagnostics completed successfully');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Quick test function for Aperture
async function quickRecordingTest() {
  console.log('\n🧪 Quick Recording Test (5 seconds):');
  
  try {
    const aperture = await import('aperture');
    const screens = await aperture.screens();
    
    if (screens.length === 0) {
      console.error('❌ No screens available');
      return;
    }
    
    console.log(`Will record screen: ${screens[0].name} (ID: ${screens[0].id})`);
    
    // Use the CORRECT API - recorder is an object, not a function
    if (!aperture.recorder || typeof aperture.recorder !== 'object') {
      throw new Error('aperture.recorder is not available as an object');
    }
    
    const recorder = aperture.recorder;
    
    const recordingOptions = {
      screenId: screens[0].id,
      fps: 15,
      showCursor: true
    };
    
    console.log('📹 Starting 5-second test recording...');
    console.log('Options:', recordingOptions);
    
    await recorder.startRecording(recordingOptions);
    console.log('✅ Recording started successfully');
    
    setTimeout(async () => {
      try {
        console.log('🛑 Stopping recording...');
        const filePath = await recorder.stopRecording();
        
        console.log('✅ Recording stopped');
        console.log('File path returned:', filePath);
        console.log('File path type:', typeof filePath);
        
        // Check if file exists
        try {
          await fs.access(filePath);
          const stats = await fs.stat(filePath);
          console.log(`✅ File found: ${filePath}`);
          console.log(`File size: ${Math.round(stats.size / 1024)}KB`);
        } catch {
          console.log(`❌ File not found: ${filePath}`);
        }
        
      } catch (error) {
        console.error('❌ Stop recording failed:', error.message);
      }
    }, 5000);
    
  } catch (error) {
    console.error('❌ Quick test failed:', error.message);
  }
}

// Run diagnostics
if (require.main === module) {
  runDiagnostics().then(() => {
    console.log('\n🧪 Run quick recording test? (y/n)');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (data) => {
      const input = data.toString().trim().toLowerCase();
      if (input === 'y') {
        quickRecordingTest();
      } else {
        process.exit(0);
      }
    });
  });
}

module.exports = { runDiagnostics, quickRecordingTest };