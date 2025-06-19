#!/usr/bin/env node
// test-scstream-fixed.js - Fixed configuration test for SCStream patterns

console.log('🧪 Fixed SCStream Creation Pattern Test');
console.log('============================================================');

const nativeModule = require('../native/whisperdesk-screencapturekit');
const { ScreenCaptureKitRecorder } = nativeModule;

async function testSCStreamPatterns() {
    try {
        console.log('🔍 Loading native ScreenCaptureKit module...');
        console.log('✅ Native module loaded successfully');
        
        console.log('🚀 Testing basic ScreenCaptureKit initialization...');
        nativeModule.initScreencapturekit();
        console.log('✅ ScreenCaptureKit initialized');
        
        // Check permissions
        const hasPermission = nativeModule.checkScreenRecordingPermission();
        console.log(`📋 Screen recording permission: ${hasPermission ? '✅ Granted' : '❌ Denied'}`);
        
        if (!hasPermission) {
            console.log('❌ Screen recording permission required. Please enable in System Preferences.');
            return;
        }
        
        console.log('🎬 Testing ScreenCaptureKit recorder creation...');
        const recorder = new ScreenCaptureKitRecorder();
        console.log('✅ ScreenCaptureKitRecorder created');
        
        console.log('🔍 Testing screen enumeration...');
        const screens = recorder.getAvailableScreensWithTimeout(3000);
        console.log(`✅ Found ${screens.length} screens`);
        
        if (screens.length === 0) {
            console.log('❌ No screens found');
            return;
        }
        
        // Show available screens
        console.log('📺 Available screens:');
        screens.slice(0, 5).forEach((screen, i) => {
            console.log(`   ${i + 1}. ${screen.name} (${screen.width}x${screen.height})`);
        });
        
        console.log('🚀 Testing SCStream creation patterns with PROPER configuration...');
        
        // Create proper configuration with ALL required fields
        const config = {
            width: 1920,
            height: 1080,
            fps: 30,
            showCursor: true,
            captureAudio: false,
            outputPath: '/tmp/test-scstream-patterns.mp4',  // ← FIXED: Required field
            pixelFormat: 'BGRA',
            colorSpace: 'sRGB'
        };
        
        console.log('🔧 Configuration created:');
        console.log(`   📁 Output: ${config.outputPath}`);
        console.log(`   📐 Resolution: ${config.width}x${config.height}`);
        console.log(`   🎥 FPS: ${config.fps}`);
        
        // Select the first display
        const targetScreen = screens.find(s => s.isDisplay) || screens[0];
        console.log(`🎯 Target screen: ${targetScreen.name} (${targetScreen.id})`);
        
        console.log('🔧 Attempting stream creation (testing all patterns)...');
        
        try {
            // This should now test all our alternative SCStream creation patterns
            recorder.startRecording(targetScreen.id, config);
            console.log('✅ Stream creation succeeded! One of the patterns worked!');
            
            // Test stopping
            console.log('🛑 Testing stream stop...');
            const outputPath = recorder.stopRecording();
            console.log(`✅ Stream stopped successfully. Output: ${outputPath}`);
            
        } catch (error) {
            console.log(`❌ Stream creation failed: ${error.message}`);
            
            // Analyze the error type
            if (error.message.includes('segmentation fault') || error.message.includes('SIGSEGV')) {
                console.log('💥 Segfault detected - none of the patterns worked');
                console.log('🔧 Need to try more alternative approaches');
            } else {
                console.log('💡 Non-segfault error - progress! The patterns might be working');
                console.log('🔧 This could be a configuration or permission issue to resolve');
            }
        }
        
    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
        console.log('🔧 Stack trace:', error.stack);
    }
    
    console.log('📋 Pattern test completed');
}

// Run the test
testSCStreamPatterns().catch(console.error); 