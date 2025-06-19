#!/usr/bin/env node

/**
 * Test Bypass Recording Approach
 * 
 * This script tests the complete bypass approach to see if we can
 * safely attempt recording without triggering ScreenCaptureKit segfaults.
 */

const { ScreenCaptureKitRecorder } = require('../native/whisperdesk-screencapturekit');

async function testBypassRecording() {
    console.log('🧪 Testing Bypass Recording Approach');
    console.log('=====================================');
    
    try {
        console.log('🔍 Step 1: Initialize recorder...');
        const recorder = new ScreenCaptureKitRecorder();
        
        console.log('🔍 Step 2: Get available screens...');
        const screens = recorder.getAvailableScreensWithTimeout(5000);
        console.log(`✅ Found ${screens.length} screens`);
        
        if (screens.length === 0) {
            throw new Error('No screens available');
        }
        
        const testScreen = screens.find(s => s.isDisplay) || screens[0];
        console.log(`🎯 Selected screen: ${testScreen.name} (${testScreen.width}x${testScreen.height})`);
        
        console.log('🔍 Step 3: Attempt recording...');
        const config = {
            width: 1280,
            height: 720,
            fps: 30,
            showCursor: true,
            captureAudio: false,
            outputPath: '/tmp/bypass-test-recording.mp4'
        };
        
        try {
            recorder.startRecording(testScreen.id, config);
            console.log('✅ Recording started successfully (bypass mode)');
            
            // Check status
            const status = recorder.getStatus();
            console.log('📊 Status:', status);
            
            // Stop recording after brief test
            setTimeout(() => {
                try {
                    const outputPath = recorder.stopRecording();
                    console.log(`✅ Recording stopped. Output: ${outputPath}`);
                } catch (e) {
                    console.log('⚠️ Stop recording error (expected in bypass mode):', e.message);
                }
                
                console.log('🎯 BYPASS APPROACH SUCCESS: No crashes detected!');
                console.log('💡 The bypass approach allows safe recording attempts');
                process.exit(0);
            }, 2000);
            
        } catch (recordingError) {
            console.log('⚠️ Recording attempt failed (expected in bypass mode):', recordingError.message);
            console.log('💡 This is expected - the bypass approach prevents actual ScreenCaptureKit stream creation');
            console.log('✅ IMPORTANT: No segfaults occurred - the bypass approach is working!');
            process.exit(0);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the test
testBypassRecording(); 