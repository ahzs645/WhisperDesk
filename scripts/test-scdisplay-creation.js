#!/usr/bin/env node

const path = require('path');

async function testSCDisplayCreation() {
    console.log('🧪 Testing SCDisplay Creation...\n');
    
    try {
        // Load the native module
        const nativeModule = require('../native/whisperdesk-screencapturekit');
        console.log('✅ Native module loaded successfully');
        
        // Check permissions first
        const hasPermission = nativeModule.checkScreenRecordingPermission();
        console.log(`🔐 Screen Recording Permission: ${hasPermission ? '✅ Granted' : '❌ Denied'}`);
        
        if (!hasPermission) {
            console.log('❌ Cannot test without screen recording permission');
            return;
        }
        
        // Initialize ScreenCaptureKit
        nativeModule.initScreencapturekit();
        console.log('✅ ScreenCaptureKit initialized');
        
        // Create recorder and get screens
        const recorder = new nativeModule.ScreenCaptureKitRecorder();
        console.log('✅ Recorder instance created');
        
        // Get available screens
        const screens = recorder.getAvailableScreensWithTimeout(5000);
        console.log(`📺 Found ${screens.length} available screens`);
        
        if (screens.length === 0) {
            console.log('❌ No screens found - cannot test SCDisplay creation');
            return;
        }
        
        // Test SCDisplay creation for first display
        const firstDisplay = screens.find(screen => screen.isDisplay);
        if (!firstDisplay) {
            console.log('❌ No display found - only windows available');
            return;
        }
        
        console.log(`\n🎯 Testing SCDisplay creation for: ${firstDisplay.name}`);
        console.log(`📐 Display dimensions: ${firstDisplay.width}x${firstDisplay.height}`);
        
        // Create content manager and test display creation
        const contentManager = new nativeModule.ContentManager();
        const shareableContent = contentManager.getShareableContentSync();
        
        console.log('\n=== SCDisplay Creation Test ===');
        
        // Extract display ID from screen ID (e.g., "display:1" -> 1)
        const displayId = parseInt(firstDisplay.id.replace('display:', ''));
        console.log(`🔍 Testing SCDisplay creation for display ID: ${displayId}`);
        
        // Test the SCDisplay creation method directly
        try {
            console.log('🎯 Calling getScDisplayById...');
            const scDisplay = shareableContent.getScDisplayById(displayId);
            
            if (scDisplay) {
                console.log('✅ Successfully created SCDisplay object!');
                console.log(`📋 SCDisplay pointer: ${scDisplay}`);
                
                // Test content filter creation with the real SCDisplay
                console.log('\n=== Content Filter Creation Test ===');
                try {
                    const contentFilter = nativeModule.createContentFilterWithDisplay(scDisplay);
                    if (contentFilter) {
                        console.log('✅ Successfully created content filter with real SCDisplay!');
                        console.log('🎉 Phase 1 SUCCESS: Real SCDisplay creation working!');
                    } else {
                        console.log('⚠️ Content filter creation failed despite having real SCDisplay');
                    }
                } catch (filterError) {
                    console.log(`⚠️ Content filter creation error: ${filterError.message}`);
                }
                
            } else {
                console.log('❌ Failed to create SCDisplay object - returned null');
                console.log('💡 This indicates the new implementation needs debugging');
            }
            
        } catch (error) {
            console.log(`❌ Error during SCDisplay creation: ${error.message}`);
            console.log('🔍 Stack trace:', error.stack);
        }
        
        console.log('\n=== Summary ===');
        console.log('📊 Test Results:');
        console.log('  - Native module: ✅ Working');
        console.log('  - Permissions: ✅ Working');
        console.log('  - Screen detection: ✅ Working');
        console.log('  - SCDisplay creation: 🧪 Testing...');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testSCDisplayCreation().catch(console.error); 