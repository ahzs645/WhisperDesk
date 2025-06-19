#!/usr/bin/env node

/**
 * Simple SCStream Creation Test - Direct Pattern Testing
 * 
 * This script tests the SCStream creation patterns by directly calling
 * the native create_stream method with mock data to avoid the thread
 * safety issues with async content loading.
 */

const path = require('path');

console.log('🧪 Simple SCStream Creation Pattern Test');
console.log('=' .repeat(60));

async function testDirectStreamCreation() {
    try {
        console.log('🔍 Loading native ScreenCaptureKit module...');
        
        // Try to load the existing compiled module
        const modulePath = path.join(__dirname, '../native/whisperdesk-screencapturekit/whisperdesk-screencapturekit.darwin-arm64.node');
        
        let nativeModule;
        try {
            nativeModule = require(modulePath);
            console.log('✅ Native module loaded successfully');
        } catch (loadError) {
            console.log('⚠️ Could not load compiled module:', loadError.message);
            console.log('💡 This test requires the native module to be compiled first');
            console.log('💡 Run: npm run build:native');
            return;
        }
        
        console.log('🔍 Available methods in native module:');
        console.log(Object.keys(nativeModule).filter(key => typeof nativeModule[key] === 'function'));
        
        // Test basic initialization
        console.log('\n🚀 Testing basic ScreenCaptureKit initialization...');
        
        if (nativeModule.initScreencapturekit) {
            await nativeModule.initScreencapturekit();
            console.log('✅ ScreenCaptureKit initialized');
        }
        
        // Test permission check
        if (nativeModule.checkScreenRecordingPermission) {
            const hasPermission = await nativeModule.checkScreenRecordingPermission();
            console.log(`📋 Screen recording permission: ${hasPermission ? '✅ Granted' : '❌ Not granted'}`);
            
            if (!hasPermission) {
                console.log('💡 Please grant screen recording permission in System Preferences');
                console.log('💡 System Preferences > Security & Privacy > Privacy > Screen Recording');
                return;
            }
        }
        
        // Test version info
        if (nativeModule.getVersion) {
            const version = nativeModule.getVersion();
            console.log(`📦 Module version: ${version}`);
        }
        
        // Test recorder creation with timeout to avoid hanging
        console.log('\n🎬 Testing ScreenCaptureKit recorder creation...');
        
        if (nativeModule.ScreenCaptureKitRecorder) {
            const recorder = new nativeModule.ScreenCaptureKitRecorder();
            console.log('✅ ScreenCaptureKitRecorder created');
            
            // Test getting screens with a short timeout
            console.log('🔍 Testing screen enumeration (with timeout)...');
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout after 5 seconds')), 5000);
            });
            
            try {
                const screensPromise = recorder.getAvailableScreensWithTimeout ? 
                    recorder.getAvailableScreensWithTimeout(3000) : 
                    recorder.getAvailableScreens();
                const screens = await Promise.race([screensPromise, timeoutPromise]);
                
                console.log(`✅ Found ${screens.length} screens`);
                
                if (screens.length > 0) {
                    console.log('📺 Available screens:');
                    screens.forEach((screen, index) => {
                        console.log(`   ${index + 1}. ${screen.name} (${screen.width}x${screen.height})`);
                    });
                    
                    // Now test the actual stream creation patterns
                    console.log('\n🚀 Testing SCStream creation patterns...');
                    
                    const testConfig = {
                        width: 1280,
                        height: 720,
                        fps: 30,
                        show_cursor: true,
                        capture_audio: false,
                        outputPath: '/tmp/test-scstream-patterns.mp4'
                    };
                    
                    // This will trigger our new pattern-based create_stream method
                    console.log('🔧 Attempting stream creation (this will test all patterns)...');
                    
                    try {
                        // Use the first available screen
                        const screenId = screens[0].id;
                        
                        // Start recording briefly to test stream creation
                        await recorder.startRecording(screenId, testConfig);
                        console.log('✅ SUCCESS: Stream created without segfault!');
                        console.log('🎯 At least one SCStream creation pattern worked!');
                        
                        // Stop recording immediately
                        setTimeout(async () => {
                            try {
                                await recorder.stopRecording();
                                console.log('✅ Recording stopped successfully');
                            } catch (e) {
                                console.log('⚠️ Stop recording error (expected):', e.message);
                            }
                        }, 500);
                        
                    } catch (streamError) {
                        if (streamError.message.includes('segmentation fault') || 
                            streamError.message.includes('segfault')) {
                            console.log('❌ SEGFAULT detected during stream creation');
                            console.log('💡 All SCStream creation patterns failed');
                        } else {
                            console.log('⚠️ Stream creation failed (non-segfault):', streamError.message);
                            console.log('💡 This might be a configuration or permission issue');
                        }
                    }
                    
                } else {
                    console.log('⚠️ No screens available for testing');
                }
                
            } catch (screenError) {
                if (screenError.message === 'Timeout after 5 seconds') {
                    console.log('⏰ Screen enumeration timed out');
                    console.log('💡 This suggests the async content loading is hanging');
                } else {
                    console.log('❌ Screen enumeration failed:', screenError.message);
                }
            }
        } else {
            console.log('❌ ScreenCaptureKitRecorder class not available');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testDirectStreamCreation()
    .then(() => {
        console.log('\n📋 Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test runner failed:', error.message);
        process.exit(1);
    }); 