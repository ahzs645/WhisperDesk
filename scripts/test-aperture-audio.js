// test-system-audio.js
/**
 * Comprehensive test for system audio capture on macOS
 * Run with: node test-system-audio.js
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

async function testSystemAudioCapture() {
  try {
    console.log('🔊 System Audio Capture Test\n');
    
    // Import Aperture
    const aperture = await import('aperture');
    const screens = await aperture.screens();
    
    console.log('📺 Using screen:', screens[0].name);
    
    // Test 1: Pure system audio (no audioDeviceId)
    console.log('\n🧪 TEST 1: Pure system audio capture');
    console.log('This is the correct way to capture system audio with ScreenCaptureKit');
    
    const config1 = {
      screenId: screens[0].id,
      fps: 15,
      // NO audioDeviceId - this enables system audio capture
    };
    
    console.log('Config:', JSON.stringify(config1, null, 2));
    
    const testPath1 = path.join(os.homedir(), 'Desktop', `system-audio-test-${Date.now()}.mp4`);
    
    console.log('\n🎵 INSTRUCTIONS:');
    console.log('1. I will start recording in 3 seconds');
    console.log('2. IMMEDIATELY play some music or a YouTube video');
    console.log('3. Recording will last 10 seconds');
    console.log('4. Check the resulting file for system audio');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n📹 Starting system audio test recording...');
    console.log('🔊 PLAY AUDIO NOW!');
    
    const recorder = aperture.recorder;
    await recorder.startRecording(config1);
    
    // Countdown
    for (let i = 10; i > 0; i--) {
      console.log(`⏱️  Recording... ${i} seconds remaining`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🛑 Stopping recording...');
    const resultPath = await recorder.stopRecording();
    
    // Move to desktop with descriptive name
    try {
      await fs.rename(resultPath, testPath1);
      console.log(`✅ Test recording saved: ${testPath1}`);
    } catch (error) {
      console.log(`✅ Test recording saved: ${resultPath}`);
    }
    
    // Check file properties
    try {
      const stats = await fs.stat(testPath1);
      console.log(`📊 File size: ${Math.round(stats.size / 1024)}KB`);
      
      if (stats.size > 100000) { // > 100KB suggests it has content
        console.log('✅ File size suggests it contains video data');
      } else {
        console.log('⚠️ File is very small - might be empty or corrupted');
      }
    } catch (error) {
      console.log('⚠️ Could not check file stats');
    }
    
    console.log('\n🔍 NEXT STEPS:');
    console.log('1. Open the saved file in QuickTime or another video player');
    console.log('2. Check if you can hear the audio you played during recording');
    console.log('3. If no audio: System audio capture not working');
    console.log('4. If audio present: System audio capture is working!');
    
    // Provide additional debugging info
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('If no system audio in the recording:');
    console.log('• Check System Settings > Privacy & Security > Screen Recording');
    console.log('• Try enabling Microphone permission as well');
    console.log('• Test with built-in screen recording (Cmd+Shift+5)');
    console.log('• Check if any audio routing software is interfering');
    
    // Test 2: Try with first audio device (for comparison)
    console.log('\n🧪 TEST 2: With first audio device (for comparison)');
    const audioDevices = await aperture.audioDevices();
    if (audioDevices.length > 0) {
      console.log(`Testing with: ${audioDevices[0].name}`);
      
      const config2 = {
        screenId: screens[0].id,
        fps: 15,
        audioDeviceId: audioDevices[0].id
      };
      
      console.log('This will likely capture microphone input, not system audio');
      console.log('Config:', JSON.stringify(config2, null, 2));
      
      // We won't actually record again, just show the config difference
    }
    
    console.log('\n💡 KEY INSIGHT:');
    console.log('For system audio: config should NOT have audioDeviceId');
    console.log('For microphone: config should have audioDeviceId set to mic ID');
    console.log('audioDevices() only returns INPUT devices, not OUTPUT devices');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function checkPermissions() {
  console.log('\n🔐 Checking Permissions...');
  
  try {
    // This will only work if running in Electron context
    const { systemPreferences } = require('electron');
    
    const screenPerm = systemPreferences.getMediaAccessStatus('screen');
    const micPerm = systemPreferences.getMediaAccessStatus('microphone');
    
    console.log(`Screen Recording: ${screenPerm}`);
    console.log(`Microphone: ${micPerm}`);
    
    if (screenPerm !== 'granted') {
      console.log('⚠️ Screen recording permission required for system audio');
    }
    
    if (micPerm !== 'granted') {
      console.log('ℹ️ Microphone permission sometimes helps with system audio');
    }
    
  } catch (error) {
    console.log('ℹ️ Permission check only works in Electron context');
  }
}

async function diagnoseAudioSetup() {
  console.log('\n🔍 Audio Setup Diagnosis...');
  
  try {
    const aperture = await import('aperture');
    const audioDevices = await aperture.audioDevices();
    
    console.log('\n📱 Available Audio Input Devices:');
    audioDevices.forEach((device, i) => {
      console.log(`${i + 1}. ${device.name}`);
      console.log(`   ID: ${device.id}`);
      
      // Identify device types
      const name = device.name.toLowerCase();
      if (name.includes('microphone') || name.includes('mic')) {
        console.log('   Type: 🎤 Microphone');
      } else if (name.includes('loopback') || name.includes('soundflower') || name.includes('blackhole')) {
        console.log('   Type: 🔄 Audio Routing (May capture system audio)');
      } else if (name.includes('teams') || name.includes('zoom') || name.includes('skype')) {
        console.log('   Type: 💼 Virtual Meeting Audio');
      } else {
        console.log('   Type: ❓ Unknown');
      }
    });
    
    console.log('\n💡 What This Means:');
    console.log('• Microphone devices capture your voice');
    console.log('• Audio routing devices can capture system audio');
    console.log('• Virtual meeting devices are from apps like Teams');
    console.log('• System audio capture happens automatically in ScreenCaptureKit');
    
    // Check for audio routing solutions
    const hasAudioRouting = audioDevices.some(d => 
      d.name.toLowerCase().includes('loopback') ||
      d.name.toLowerCase().includes('soundflower') ||
      d.name.toLowerCase().includes('blackhole')
    );
    
    if (hasAudioRouting) {
      console.log('\n✅ Audio routing device detected!');
      console.log('Try using one of these devices for better system audio capture');
    } else {
      console.log('\n💡 Consider installing audio routing software:');
      console.log('• BlackHole (free): https://github.com/ExistentialAudio/BlackHole');
      console.log('• SoundFlower (free): https://github.com/mattingalls/Soundflower');
      console.log('• Loopback (paid): https://rogueamoeba.com/loopback/');
    }
    
  } catch (error) {
    console.error('❌ Audio diagnosis failed:', error.message);
  }
}

// Run all tests
if (require.main === module) {
  console.log('Starting comprehensive system audio test...\n');
  
  checkPermissions()
    .then(() => diagnoseAudioSetup())
    .then(() => testSystemAudioCapture())
    .catch(error => {
      console.error('❌ Test suite failed:', error.message);
    });
}

module.exports = { testSystemAudioCapture, checkPermissions, diagnoseAudioSetup };