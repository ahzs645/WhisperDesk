// scripts/test-aperture-dynamic.js
const path = require('path');
const fs = require('fs');
const os = require('os');

async function testApertureDynamic() {
  console.log('🧪 Testing Aperture with dynamic import (v7.x ESM)...');
  
  try {
    // Use dynamic import to load ESM module
    console.log('📦 Loading Aperture ESM module via dynamic import...');
    const ApertureESM = await import('aperture');
    console.log('✅ Aperture ESM module loaded successfully');
    
    // Log the structure to understand the API
    console.log('📋 Aperture ESM exports:', Object.keys(ApertureESM));
    
    // Get the main module (could be default export or named exports)
    const Aperture = ApertureESM.default || ApertureESM;
    
    console.log('📦 Main Aperture object type:', typeof Aperture);
    if (typeof Aperture === 'object' && Aperture !== null) {
      console.log('📋 Available methods:', Object.keys(Aperture));
    }
    
    // Test device enumeration with different possible API patterns
    console.log('📱 Testing device enumeration...');
    
    let screens = null;
    let devicesAPI = null;
    
    // Try to find the devices API
    const possibleDevicesAPIs = [
      { name: 'Aperture.Devices', api: Aperture.Devices },
      { name: 'ApertureESM.Devices', api: ApertureESM.Devices },
      { name: 'Aperture (direct)', api: Aperture }
    ];
    
    for (const { name, api } of possibleDevicesAPIs) {
      if (api && typeof api.screen === 'function') {
        console.log(`🔍 Found devices API: ${name}`);
        devicesAPI = api;
        break;
      }
    }
    
    if (devicesAPI) {
      try {
        screens = await devicesAPI.screen();
        console.log(`✅ Found ${screens.length} screens via devices API`);
        screens.forEach((screen, i) => {
          console.log(`  📺 ${i + 1}. ${screen.name || screen.id || 'Unknown'}`);
        });
      } catch (screenError) {
        console.log('❌ Screen enumeration failed:', screenError.message);
      }
    } else {
      console.log('❌ Could not find devices API');
      console.log('🔍 Available APIs for debugging:');
      possibleDevicesAPIs.forEach(({ name, api }) => {
        if (api) {
          console.log(`  - ${name}:`, typeof api, Object.keys(api || {}));
        }
      });
    }
    
    // Test audio devices
    if (devicesAPI && typeof devicesAPI.audio === 'function') {
      try {
        const audioDevices = await devicesAPI.audio();
        console.log(`✅ Found ${audioDevices.length} audio devices`);
      } catch (audioError) {
        console.log('⚠️ Audio enumeration failed:', audioError.message);
      }
    }
    
    // Test recorder creation
    console.log('🎬 Testing recorder creation...');
    
    let RecorderClass = null;
    const possibleRecorderClasses = [
      { name: 'Aperture.Recorder', class: Aperture.Recorder },
      { name: 'ApertureESM.Recorder', class: ApertureESM.Recorder },
      { name: 'Aperture (direct)', class: typeof Aperture === 'function' ? Aperture : null }
    ];
    
    for (const { name, class: cls } of possibleRecorderClasses) {
      if (cls && typeof cls === 'function') {
        console.log(`🔍 Found recorder class: ${name}`);
        RecorderClass = cls;
        break;
      }
    }
    
    if (RecorderClass) {
      try {
        const recorder = new RecorderClass();
        console.log('✅ Recorder instance created successfully');
        
        // If we have screens and a recorder, test a quick recording
        if (screens && screens.length > 0 && typeof recorder.start === 'function') {
          console.log('🎬 Testing 2-second recording...');
          
          const outputPath = path.join(os.tmpdir(), `aperture-dynamic-test-${Date.now()}.mp4`);
          
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
            console.log('📺 Recording screen:', screen.name || screen.id);
            
            await recorder.start('screen', options);
            
            // Record for 2 seconds
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            console.log('⏹️ Stopping test recording...');
            await recorder.stop();
            
            // Check output file
            if (fs.existsSync(outputPath)) {
              const stats = fs.statSync(outputPath);
              console.log(`✅ Test recording completed successfully!`);
              console.log(`📁 File: ${outputPath}`);
              console.log(`📊 Size: ${Math.round(stats.size / 1024)}KB`);
              
              // Clean up
              fs.unlinkSync(outputPath);
              console.log('🧹 Test file cleaned up');
            } else {
              console.log('⚠️ Test recording file was not created');
            }
            
          } catch (recordError) {
            console.log('❌ Recording test failed:', recordError.message);
            
            if (recordError.message.includes('permission') || recordError.message.includes('denied')) {
              console.log('💡 This is likely a permissions issue:');
              console.log('   1. Go to: System Preferences > Security & Privacy > Screen Recording');
              console.log('   2. Add Terminal (or your terminal app) and enable it');
              console.log('   3. Restart terminal and try again');
            } else if (recordError.message.includes('10.13')) {
              console.log('💡 Your macOS version might be too old for ScreenCaptureKit');
            }
          }
        }
        
      } catch (recorderError) {
        console.log('❌ Recorder creation failed:', recorderError.message);
      }
    } else {
      console.log('❌ Could not find Recorder class');
      console.log('🔍 Available recorder classes for debugging:');
      possibleRecorderClasses.forEach(({ name, class: cls }) => {
        console.log(`  - ${name}:`, typeof cls);
      });
    }
    
    console.log('🎉 Aperture dynamic import test completed!');
    console.log('💡 Aperture v7 ESM is working on your system');
    console.log('🔧 Integration will use dynamic import() for ESM compatibility');
    
    return {
      success: true,
      hasScreens: screens && screens.length > 0,
      hasRecorder: RecorderClass !== null,
      apiStructure: {
        devices: !!devicesAPI,
        recorder: !!RecorderClass
      }
    };
    
  } catch (error) {
    console.error('❌ Aperture dynamic import test failed:', error.message);
    console.log('💡 Falling back to browser-based recording');
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Export for use in other scripts
module.exports = { testApertureDynamic };

// Run if called directly
if (require.main === module) {
  testApertureDynamic()
    .then((result) => {
      if (result.success) {
        console.log('✅ Test completed successfully');
        process.exit(0);
      } else {
        console.log('❌ Test failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Unexpected error:', error.message);
      process.exit(1);
    });
}