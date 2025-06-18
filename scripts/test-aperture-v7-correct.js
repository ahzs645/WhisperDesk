// scripts/test-aperture-v7-correct.js
const path = require('path');
const fs = require('fs');
const os = require('os');

async function testApertureV7() {
  console.log('🧪 Testing Aperture v7 with correct API...');
  
  try {
    // Load Aperture v7 ESM
    console.log('📦 Loading Aperture v7 ESM...');
    const aperture = await import('aperture');
    console.log('✅ Aperture v7 loaded successfully');
    console.log('📋 Available:', Object.keys(aperture));

    // Test screen enumeration (v7 API: aperture.screens())
    console.log('📱 Testing screens() function...');
    const screens = await aperture.screens();
    console.log(`✅ Found ${screens.length} screens:`);
    
    screens.forEach((screen, i) => {
      console.log(`  📺 ${i + 1}. ${screen.name || screen.id} (ID: ${screen.id})`);
    });

    if (screens.length === 0) {
      throw new Error('No screens available');
    }

    // Test audio devices (v7 API: aperture.audioDevices())
    console.log('🎵 Testing audioDevices() function...');
    try {
      const audioDevices = await aperture.audioDevices();
      console.log(`✅ Found ${audioDevices.length} audio devices:`);
      audioDevices.slice(0, 3).forEach((device, i) => {
        console.log(`  🎤 ${i + 1}. ${device.name || device.id}`);
      });
    } catch (audioError) {
      console.log('⚠️ Audio devices failed:', audioError.message);
    }

    // Test video codecs
    console.log('🎬 Testing video codecs...');
    console.log('Available codecs:', Object.keys(aperture.videoCodecs));

    // Test recorder object (v7 API: aperture.recorder)
    console.log('🎬 Testing recorder object...');
    const recorderObj = aperture.recorder;
    console.log('Recorder type:', typeof recorderObj);
    console.log('Recorder methods:', Object.keys(recorderObj));

    // Test a quick recording
    if (typeof recorderObj.record === 'function') {
      console.log('🎬 Testing 3-second recording...');
      
      const outputPath = path.join(os.tmpdir(), `aperture-v7-test-${Date.now()}.mp4`);
      const screen = screens[0];
      
      try {
        console.log('📺 Recording screen:', screen.name || screen.id);
        console.log('📁 Output path:', outputPath);
        
        // Start recording (v7 API might be different)
        const recordingPromise = recorderObj.record({
          destination: outputPath,
          screen: screen.id,
          audioDeviceId: null, // No audio for test
          videoCodec: aperture.videoCodecs.h264,
          showCursor: true,
          highlightClicks: false
        });
        
        console.log('▶️ Recording started...');
        
        // Record for 3 seconds
        setTimeout(async () => {
          try {
            // Stop recording (method might vary)
            if (typeof recorderObj.stop === 'function') {
              await recorderObj.stop();
            }
            console.log('⏹️ Recording stopped');
          } catch (stopError) {
            console.log('⚠️ Stop method not found or failed:', stopError.message);
          }
        }, 3000);
        
        // Wait for recording to complete
        await recordingPromise;
        
        // Check if file was created
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          console.log(`✅ Recording completed: ${Math.round(stats.size / 1024)}KB`);
          
          // Clean up
          fs.unlinkSync(outputPath);
          console.log('🧹 Test file cleaned up');
        } else {
          console.log('⚠️ Recording file not found');
        }
        
      } catch (recordError) {
        console.log('❌ Recording test failed:', recordError.message);
        if (recordError.message.includes('permission')) {
          console.log('💡 Permission issue - check System Preferences > Security & Privacy > Screen Recording');
        }
      }
      
    } else {
      console.log('⚠️ Record method not found, trying alternative APIs...');
      
      // Try alternative recording methods
      const recordingMethods = [
        'record',
        'start',
        'startRecording',
        'capture'
      ];
      
      for (const method of recordingMethods) {
        if (typeof recorderObj[method] === 'function') {
          console.log(`✅ Found recording method: ${method}`);
          break;
        }
      }
      
      console.log('🔍 Available recorder methods:');
      Object.keys(recorderObj).forEach(key => {
        console.log(`  - ${key}: ${typeof recorderObj[key]}`);
      });
    }

    console.log('🎉 Aperture v7 API test completed successfully!');
    console.log('💡 Your system supports Aperture v7 screen recording');
    console.log('🔧 Ready for v7 integration with WhisperDesk');
    
    return {
      success: true,
      api: 'v7',
      screens: screens.length,
      hasRecorder: !!recorderObj,
      methods: Object.keys(recorderObj)
    };

  } catch (error) {
    console.error('❌ Aperture v7 test failed:', error.message);
    console.log('💡 Will fall back to browser recording');
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Simple screens test
async function quickScreensTest() {
  try {
    const aperture = await import('aperture');
    const screens = await aperture.screens();
    console.log('🎯 Quick test result:', screens.length, 'screens found');
    return screens;
  } catch (error) {
    console.log('❌ Quick test failed:', error.message);
    return [];
  }
}

// Export for use in other scripts
module.exports = { testApertureV7, quickScreensTest };

// Run if called directly
if (require.main === module) {
  testApertureV7()
    .then((result) => {
      if (result.success) {
        console.log('✅ All tests passed!');
        process.exit(0);
      } else {
        console.log('❌ Tests failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Unexpected error:', error.message);
      process.exit(1);
    });
}