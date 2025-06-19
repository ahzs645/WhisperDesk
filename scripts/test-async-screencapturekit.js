#!/usr/bin/env node

/**
 * Test script for the new timeout-based ScreenCaptureKit implementation
 * This demonstrates the solution to the content retrieval segfault issue
 */

const path = require('path');

// Import the native module
let screencapturekit;
try {
    screencapturekit = require('../native/whisperdesk-screencapturekit/whisperdesk-screencapturekit.darwin-arm64.node');
} catch (error) {
    console.error('❌ Failed to load ScreenCaptureKit module:', error.message);
    console.log('💡 Make sure to build the module first: cd native/whisperdesk-screencapturekit && npm run build');
    process.exit(1);
}

async function testTimeoutScreenCaptureKit() {
    console.log('🚀 Testing Timeout-based ScreenCaptureKit Implementation');
    console.log('=' .repeat(60));
    
    try {
        // Test 1: Basic permissions and API test
        console.log('\n📋 Step 1: Basic API Test');
        const basicTest = screencapturekit.testPermissionsAndApi();
        console.log(basicTest);
        
        // Test 2: Timeout functionality test
        console.log('\n🔄 Step 2: Timeout Functionality Test');
        const timeoutTest = screencapturekit.testScreencapturekitWithTimeout();
        console.log(timeoutTest);
        
        // Test 3: Test the new timeout recorder methods
        console.log('\n📺 Step 3: Testing Timeout Screen Recorder');
        const recorder = new screencapturekit.ScreenCaptureKitRecorder();
        
        console.log('Testing sync method (should use cache or fallback):');
        try {
            const syncSources = recorder.getAvailableScreens();
            console.log(`✅ Sync method found ${syncSources.length} sources`);
            
            // Show first few sources
            syncSources.slice(0, 3).forEach((source, i) => {
                const type = source.isDisplay ? '📺' : '🪟';
                console.log(`  ${type} ${i + 1}. ${source.name} (${source.width}x${source.height})`);
            });
        } catch (error) {
            console.log(`⚠️ Sync method failed as expected: ${error.message}`);
            console.log('💡 This is expected behavior - now testing timeout method...');
        }
        
        console.log('\nTesting timeout method (proper ScreenCaptureKit timeout handling):');
        try {
            const timeoutSources = recorder.getAvailableScreensWithTimeout(5000);
            console.log(`✅ Timeout method found ${timeoutSources.length} sources`);
            
            // Show first few sources
            timeoutSources.slice(0, 5).forEach((source, i) => {
                const type = source.isDisplay ? '📺' : '🪟';
                console.log(`  ${type} ${i + 1}. ${source.name} (${source.width}x${source.height})`);
            });
            
            // Test 4: Now test sync method again (should work with cached content)
            console.log('\nTesting sync method again (should work with cached content):');
            const cachedSources = recorder.getAvailableScreens();
            console.log(`✅ Sync method with cache found ${cachedSources.length} sources`);
            
        } catch (error) {
            console.error(`❌ Timeout method failed: ${error.message}`);
            if (error.message.includes('permission')) {
                console.log('💡 Please enable screen recording permission in System Preferences > Security & Privacy > Privacy > Screen Recording');
            } else if (error.message.includes('timeout')) {
                console.log('💡 This indicates the async/sync mismatch issue - the timeout approach helps avoid segfaults');
            }
        }
        
        console.log('\n🎉 Timeout-based ScreenCaptureKit test completed!');
        console.log('\n📖 Summary of the solution:');
        console.log('  • Fixed segfault by using timeout-protected completion handlers');
        console.log('  • Avoided thread safety issues with raw pointers');
        console.log('  • Used std::sync primitives (Mutex, Condvar) for synchronization');
        console.log('  • Implemented content caching for sync fallback methods');
        console.log('  • Graceful error handling with helpful error messages');
        console.log('  • Timeout protection (5s default) prevents hanging');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
    }
}

// Run the test
if (require.main === module) {
    testTimeoutScreenCaptureKit().catch(console.error);
}

module.exports = { testTimeoutScreenCaptureKit }; 