// Test the objc2 ScreenCaptureKit integration
const Objc2ScreenCaptureRecorder = require('../src/main/screen-recorder/recorders/Objc2ScreenCaptureRecorder');

async function testObjc2Integration() {
    console.log('🧪 Testing objc2 ScreenCaptureKit integration...');
    
    if (process.platform !== 'darwin') {
        console.log('⏭️ Skipping on non-macOS platform');
        return;
    }
    
    try {
        const recorder = new Objc2ScreenCaptureRecorder();
        
        // Test initialization
        console.log('📦 Testing initialization...');
        await recorder.initialize();
        console.log('✅ Initialization successful');
        
        // Test screen enumeration
        console.log('📺 Testing screen enumeration...');
        const result = await recorder.getAvailableScreens();
        console.log(`✅ Found ${result.screens.length} screens`);
        
        // Test audio device enumeration
        console.log('🔊 Testing audio device enumeration...');
        const audioDevices = await recorder.getAvailableAudioDevices();
        console.log(`✅ Found ${audioDevices.devices.length} audio devices`);
        
        // Test status
        console.log('📊 Testing status...');
        const status = recorder.getStatus();
        console.log('✅ Status:', status.method);
        
        // Test permissions
        console.log('🔐 Testing permissions...');
        const permissions = await recorder.checkPermissions();
        console.log('✅ Permissions:', permissions);
        
        // Cleanup
        recorder.destroy();
        
        console.log('🎉 All objc2 ScreenCaptureKit tests passed!');
        
    } catch (error) {
        console.error('❌ objc2 ScreenCaptureKit test failed:', error);
        process.exit(1);
    }
}

testObjc2Integration(); 