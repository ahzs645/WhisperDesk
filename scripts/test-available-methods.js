#!/usr/bin/env node

async function testAvailableMethods() {
    console.log('🔍 Checking available methods on ShareableContent...\n');
    
    try {
        // Load the native module
        const nativeModule = require('../native/whisperdesk-screencapturekit');
        console.log('✅ Native module loaded successfully');
        
        // Initialize
        nativeModule.initScreencapturekit();
        
        // Create content manager and get content
        const contentManager = new nativeModule.ContentManager();
        const shareableContent = contentManager.getShareableContentSync();
        
        console.log('\n=== ShareableContent Methods ===');
        console.log('Available methods and properties:');
        
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(shareableContent));
        methods.forEach(method => {
            console.log(`  - ${method}`);
        });
        
        console.log('\n=== Direct Property Check ===');
        console.log('get_sc_display_by_id:', typeof shareableContent.get_sc_display_by_id);
        console.log('getScDisplayById:', typeof shareableContent.getScDisplayById);
        console.log('get_displays:', typeof shareableContent.get_displays);
        console.log('getDisplays:', typeof shareableContent.getDisplays);
        
        console.log('\n=== Available Properties ===');
        for (let prop in shareableContent) {
            console.log(`  - ${prop}: ${typeof shareableContent[prop]}`);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

testAvailableMethods().catch(console.error); 