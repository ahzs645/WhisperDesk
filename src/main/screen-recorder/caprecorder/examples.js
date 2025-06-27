/**
 * @fileoverview CapRecorder examples
 * Demonstrates various usage patterns for the CapRecorder library
 */

const { CapRecorder, listAvailableScreens, listAvailableWindows, hasScreenCapturePermission } = require('@firstform/caprecorder');
const path = require('path');

/**
 * Check if CapRecorder is available and permissions are granted
 */
async function checkCapRecorderAvailability() {
  console.log('🔍 Checking CapRecorder availability...');
  
  try {
    // Check permissions
    const hasPermission = hasScreenCapturePermission();
    console.log('🔐 Screen capture permission:', hasPermission ? '✅ Granted' : '❌ Denied');
    
    if (!hasPermission) {
      console.log('📝 Please grant screen recording permission in System Preferences');
      console.log('   macOS: System Preferences > Security & Privacy > Privacy > Screen Recording');
      return false;
    }
    
    // List available screens
    const screens = listAvailableScreens();
    console.log(`📺 Available screens: ${screens.length}`);
    screens.forEach((screen, index) => {
      console.log(`   ${index + 1}. ${screen.name} (ID: ${screen.id}, Refresh: ${screen.refreshRate}Hz)`);
    });
    
    // List available windows
    const windows = listAvailableWindows();
    console.log(`🪟 Available windows: ${windows.length}`);
    windows.slice(0, 5).forEach((window, index) => {
      console.log(`   ${index + 1}. ${window.title} (${window.ownerName}) - ID: ${window.id}`);
    });
    
    if (windows.length > 5) {
      console.log(`   ... and ${windows.length - 5} more windows`);
    }
    
    return screens.length > 0;
    
  } catch (error) {
    console.error('❌ Failed to check CapRecorder availability:', error);
    return false;
  }
}

/**
 * Example: Basic screen recording
 */
async function exampleScreenRecording() {
  console.log('\n🎬 Example: Screen Recording');
  console.log('=====================================');
  
  if (!await checkCapRecorderAvailability()) {
    console.log('❌ CapRecorder not available');
    return;
  }
  
  const recorder = new CapRecorder();
  const screens = listAvailableScreens();
  
  try {
    console.log('🎬 Starting screen recording...');
    
    await recorder.startRecording({
      outputPath: './recordings/screen-recording',
      screenId: screens[0].id,
      captureSystemAudio: true,
      fps: 30
    });
    
    console.log('📹 Recording for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const outputPath = await recorder.stopRecording();
    console.log('✅ Screen recording saved to:', outputPath);
    
  } catch (error) {
    console.error('❌ Screen recording failed:', error);
    
    try {
      await recorder.cancelRecording();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Example: Window recording
 */
async function exampleWindowRecording() {
  console.log('\n🪟 Example: Window Recording');
  console.log('=====================================');
  
  if (!await checkCapRecorderAvailability()) {
    console.log('❌ CapRecorder not available');
    return;
  }
  
  const recorder = new CapRecorder();
  const windows = listAvailableWindows();
  
  if (windows.length === 0) {
    console.log('❌ No windows available for recording');
    return;
  }
  
  // Find a specific window or use the first one
  const targetWindow = windows.find(w => w.title.includes('VS Code')) || windows[0];
  console.log('🎯 Target window:', targetWindow.title, `(${targetWindow.ownerName})`);
  
  try {
    console.log('🎬 Starting window recording...');
    
    await recorder.startRecording({
      outputPath: './recordings/window-recording',
      windowId: targetWindow.id,
      captureSystemAudio: false, // Usually don't need audio for window recording
      fps: 30
    });
    
    console.log('📹 Recording for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const outputPath = await recorder.stopRecording();
    console.log('✅ Window recording saved to:', outputPath);
    
  } catch (error) {
    console.error('❌ Window recording failed:', error);
    
    try {
      await recorder.cancelRecording();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Example: Audio-only recording (low FPS to minimize video file size)
 */
async function exampleAudioRecording() {
  console.log('\n🔊 Example: Audio-Only Recording');
  console.log('=====================================');
  
  if (!await checkCapRecorderAvailability()) {
    console.log('❌ CapRecorder not available');
    return;
  }
  
  const recorder = new CapRecorder();
  const screens = listAvailableScreens();
  
  try {
    console.log('🎬 Starting audio-only recording...');
    
    await recorder.startRecording({
      outputPath: './recordings/audio-only',
      screenId: screens[0].id,
      captureSystemAudio: true,
      fps: 1 // Very low fps to minimize video file size
    });
    
    console.log('🎵 Recording audio for 30 seconds...');
    console.log('📝 Play some audio to test system audio capture');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    const outputPath = await recorder.stopRecording();
    console.log('✅ Audio recording saved to:', outputPath);
    console.log('📁 Check the segments folder for the .ogg audio file');
    
  } catch (error) {
    console.error('❌ Audio recording failed:', error);
    
    try {
      await recorder.cancelRecording();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Example: Pause and resume recording
 */
async function examplePauseResumeRecording() {
  console.log('\n⏸️ Example: Pause/Resume Recording');
  console.log('=====================================');
  
  if (!await checkCapRecorderAvailability()) {
    console.log('❌ CapRecorder not available');
    return;
  }
  
  const recorder = new CapRecorder();
  const screens = listAvailableScreens();
  
  try {
    console.log('🎬 Starting recording...');
    
    await recorder.startRecording({
      outputPath: './recordings/pause-resume-test',
      screenId: screens[0].id,
      captureSystemAudio: false,
      fps: 30
    });
    
    // Record for 5 seconds
    console.log('📹 Recording for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Pause
    console.log('⏸️ Pausing recording...');
    await recorder.pauseRecording();
    
    // Wait 3 seconds while paused
    console.log('⏱️ Paused for 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Resume
    console.log('▶️ Resuming recording...');
    await recorder.resumeRecording();
    
    // Record for another 5 seconds
    console.log('📹 Recording for another 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const outputPath = await recorder.stopRecording();
    console.log('✅ Pause/resume recording saved to:', outputPath);
    
  } catch (error) {
    console.error('❌ Pause/resume recording failed:', error);
    
    try {
      await recorder.cancelRecording();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 CapRecorder Examples');
  console.log('========================\n');
  
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('screen')) {
    await exampleScreenRecording();
  }
  
  if (args.length === 0 || args.includes('window')) {
    await exampleWindowRecording();
  }
  
  if (args.length === 0 || args.includes('audio')) {
    await exampleAudioRecording();
  }
  
  if (args.length === 0 || args.includes('pause')) {
    await examplePauseResumeRecording();
  }
  
  console.log('\n✅ Examples completed!');
  console.log('📁 Check the ./recordings/ folder for output files');
}

// Export for use in other modules
module.exports = {
  checkCapRecorderAvailability,
  exampleScreenRecording,
  exampleWindowRecording,
  exampleAudioRecording,
  examplePauseResumeRecording,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
