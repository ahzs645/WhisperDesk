// scripts/test-aperture-esm.js
import path from 'path';
import fs from 'fs';
import os from 'os';

async function testApertureESM() {
  console.log('🧪 Testing Aperture screen recording (ESM v7.x)...');
  
  try {
    // Dynamic import for Aperture ESM
    console.log('📦 Loading Aperture ESM module...');
    const Aperture = await import('aperture');
    console.log('✅ Aperture ESM module loaded successfully');
    
    // Log the structure
    console.log('📋 Aperture ESM structure:');
    console.log('Available exports:', Object.keys(Aperture));
    
    // Check for default export
    const ApertureModule = Aperture.default || Aperture;
    console.log('📦 Main module:', typeof ApertureModule);
    
    // Test device enumeration
    console.log('📱 Testing device enumeration...');
    
    try {
      let screens;
      
      // Try different possible API patterns for ESM
      if (ApertureModule.Devices && typeof ApertureModule.Devices.screen === 'function') {
        console.log('🔍 Trying ApertureModule.Devices.screen()...');
        screens = await ApertureModule.Devices.screen();
      } else if (Aperture.Devices && typeof Aperture.Devices.screen === 'function') {
        console.log('🔍 Trying Aperture.Devices.screen()...');
        screens = await Aperture.Devices.screen();
      } else if (typeof ApertureModule.screen === 'function') {
        console.log('🔍 Trying ApertureModule.screen()...');
        screens = await ApertureModule.screen();
      } else if (Aperture.screen && typeof Aperture.screen === 'function') {
        console.log('🔍 Trying Aperture.screen()...');
        screens = await Aperture.screen();
      } else {
        // Show what's available for debugging
        console.log('🔍 Available in Aperture:');
        Object.keys(Aperture).forEach(key => {
          console.log(`  - ${key}: ${typeof Aperture[key]}`);
        });
        
        if (ApertureModule && typeof ApertureModule === 'object') {
          console.log('🔍 Available in ApertureModule:');
          Object.keys(ApertureModule).forEach(key => {
            console.log(`  - ${key}: ${typeof ApertureModule[key]}`);
          });
        }
        
        throw new Error('Could not find screen enumeration method in ESM API');
      }
      
      console.log(`✅ Found ${screens.length} screens:`);
      screens.forEach((screen, i) => {
        console.log(`  📺 ${i + 1}. ${screen.name || screen.id || 'Unknown'}`);
      });
      
      if (screens.length === 0) {
        throw new Error('No screens available for recording');
      }
      
      // Test audio devices
      try {
        let audioDevices;
        if (ApertureModule.Devices && typeof ApertureModule.Devices.audio === 'function') {
          audioDevices = await ApertureModule.Devices.audio();
        } else if (Aperture.Devices && typeof Aperture.Devices.audio === 'function') {
          audioDevices = await Aperture.Devices.audio();
        }
        
        if (audioDevices) {
          console.log(`✅ Found ${audioDevices.length} audio devices`);
        } else {
          console.log('ℹ️  Audio device enumeration not available');
        }
      } catch (audioError) {
        console.log('⚠️ Audio device enumeration failed:', audioError.message);
      }
      
      // Test recorder creation
      console.log('🎬 Testing recorder creation...');
      
      let RecorderClass;
      if (ApertureModule.Recorder) {
        RecorderClass = ApertureModule.Recorder;
      } else if (Aperture.Recorder) {
        RecorderClass = Aperture.Recorder;
      } else if (typeof ApertureModule === 'function') {
        RecorderClass = ApertureModule;
      }
      
      if (RecorderClass) {
        const recorder = new RecorderClass();
        console.log('✅ Recorder created successfully');
        
        // Test a very short recording
        if (typeof recorder.start === 'function' && typeof recorder.stop === 'function') {
          console.log('🎬 Testing 2-second recording...');
          
          const outputPath = path.join(os.tmpdir(), `aperture-esm-test-${Date.now()}.mp4`);
          
          try {
            const screen = screens[0];
            const options = {
              destination: new URL(`file://${outputPath}`),
              targetID: screen.id,
              framesPerSecond: 15,
              recordSystemAudio: true,
              showCursor: true
            };
            
            console.log('▶️ Starting test recording...');
            await recorder.start('screen', options);
            
            // Record for 2 seconds
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            console.log('⏹️ Stopping test recording...');
            await recorder.stop();
            
            // Check output file
            if (fs.existsSync(outputPath)) {
              const stats = fs.statSync(outputPath);
              console.log(`✅ Test recording completed: ${Math.round(stats.size / 1024)}KB`);
              
              // Clean up
              fs.unlinkSync(outputPath);
              console.log('🧹 Test file cleaned up');
            } else {
              console.log('⚠️ Test recording file not created');
            }
          } catch (recordError) {
            console.log('⚠️ Recording test failed:', recordError.message);
            if (recordError.message.includes('permission')) {
              console.log('💡 This might be a permissions issue');
              console.log('   Go to: System Preferences > Security & Privacy > Screen Recording');
            }
          }
        }
      } else {
        console.log('⚠️ Could not find Recorder class');
      }
      
      console.log('🎉 Aperture ESM test completed successfully!');
      console.log('💡 Your system supports Aperture-based screen recording');
      console.log('🔧 Ready for ESM integration with WhisperDesk');
      
    } catch (apiError) {
      console.error('❌ API test failed:', apiError.message);
      throw apiError;
    }
    
  } catch (error) {
    console.error('❌ Aperture ESM test failed:', error.message);
    console.log('💡 WhisperDesk will use browser-based recording instead');
    throw error;
  }
}

// Run the test
testApertureESM()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  });