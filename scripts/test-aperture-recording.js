import { recorder, screens, audioDevices } from 'aperture';
import fs from 'fs';
import path from 'path';

async function testSystemAudioCapture() {
    console.log('🔊 Enhanced System Audio Capture Test for macOS\n');

    try {
        // Get available devices
        const availableScreens = await screens();
        const availableAudio = await audioDevices();
        
        console.log('📺 Available Screens:');
        availableScreens.forEach((screen, i) => {
            console.log(`  ${i + 1}. ${screen.name} (ID: ${screen.id})`);
        });
        
        console.log('\n📱 Available Audio Devices:');
        availableAudio.forEach((device, i) => {
            const isBlackHole = device.name.toLowerCase().includes('blackhole');
            const isLoopback = device.name.toLowerCase().includes('loopback');
            const isSystemAudio = isBlackHole || isLoopback;
            
            console.log(`  ${i + 1}. ${device.name}`);
            console.log(`     ID: ${device.id}`);
            console.log(`     Type: ${isSystemAudio ? '🔊 System Audio Device' : '🎤 Microphone'}`);
        });

        // Check for system audio devices
        const systemAudioDevices = availableAudio.filter(device => 
            device.name.toLowerCase().includes('blackhole') ||
            device.name.toLowerCase().includes('soundflower') ||
            device.name.toLowerCase().includes('loopback')
        );

        if (systemAudioDevices.length === 0) {
            console.log('\n⚠️  NO SYSTEM AUDIO DEVICES FOUND!');
            console.log('📝 To capture system audio on macOS, you need:');
            console.log('   1. BlackHole: brew install blackhole-2ch');
            console.log('   2. SoundFlower: https://github.com/mattingalls/Soundflower');
            console.log('   3. Loopback (paid): https://rogueamoeba.com/loopback/');
            console.log('\n🔧 After installing, configure your system audio output to route through the virtual device.');
        }

        // Test configurations
        const testConfigs = [
            {
                name: 'Pure ScreenCaptureKit (system audio via entitlements)',
                options: {
                    fps: 30,
                    showCursor: false,
                    screenId: availableScreens[0].id,
                    // NO audioDeviceId - this tells ScreenCaptureKit to capture system audio
                }
            }
        ];

        // Add system audio device test if available
        if (systemAudioDevices.length > 0) {
            testConfigs.push({
                name: `Virtual Audio Device (${systemAudioDevices[0].name})`,
                options: {
                    fps: 30,
                    showCursor: false,
                    screenId: availableScreens[0].id,
                    audioDeviceId: systemAudioDevices[0].id
                }
            });
        }

        // Run tests
        for (let i = 0; i < testConfigs.length; i++) {
            const config = testConfigs[i];
            console.log(`\n🧪 TEST ${i + 1}: ${config.name}`);
            console.log('📋 Configuration:', JSON.stringify(config.options, null, 2));

            try {
                // Start recording
                console.log('🎬 Starting recording...');
                await recorder.startRecording(config.options);
                
                // Wait for file to be ready
                const filePath = await recorder.isFileReady;
                console.log(`📁 Recording file: ${path.basename(filePath)}`);

                // Record for 8 seconds with countdown
                console.log('\n🎵 PLAY AUDIO NOW! Recording for 8 seconds...');
                for (let sec = 8; sec > 0; sec--) {
                    console.log(`⏱️  ${sec} seconds remaining...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // Stop recording
                console.log('\n🛑 Stopping recording...');
                const finalPath = await recorder.stopRecording();
                
                // Check file
                const stats = fs.statSync(finalPath);
                const fileSizeKB = Math.round(stats.size / 1024);
                
                console.log(`✅ Recording saved: ${finalPath}`);
                console.log(`📊 File size: ${fileSizeKB}KB`);
                
                // Move to desktop for easy access
                const desktopPath = path.join(process.env.HOME, 'Desktop', `system-audio-test-${i + 1}-${Date.now()}.mp4`);
                fs.renameSync(finalPath, desktopPath);
                console.log(`📁 Moved to desktop: ${path.basename(desktopPath)}`);

                // Analyze result
                if (fileSizeKB > 1000) {
                    console.log('✅ Good file size - likely contains video data');
                } else {
                    console.log('⚠️  Small file size - may not contain audio');
                }

            } catch (error) {
                console.error(`❌ Test ${i + 1} failed:`, error.message);
            }

            // Wait between tests
            if (i < testConfigs.length - 1) {
                console.log('\n⏳ Waiting 3 seconds before next test...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        // Final instructions
        console.log('\n🔍 VERIFICATION STEPS:');
        console.log('1. Open the test video files on your Desktop');
        console.log('2. Check if you can hear the audio you played');
        console.log('3. If no audio is present, try the solutions below');

        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('1. Check System Settings > Privacy & Security > Screen Recording');
        console.log('2. Check System Settings > Privacy & Security > Microphone');
        console.log('3. Install BlackHole: brew install blackhole-2ch');
        console.log('4. Set BlackHole as your system audio output during recording');
        console.log('5. Ensure your app has proper entitlements (see entitlements.plist)');

        console.log('\n💡 MACOS SYSTEM AUDIO FACTS:');
        console.log('• ScreenCaptureKit can capture system audio with proper entitlements');
        console.log('• Virtual audio devices (BlackHole) provide more reliable system audio capture');
        console.log('• Some apps require signed entitlements for system audio access');
        console.log('• audioDevices() only shows INPUT devices, not OUTPUT devices');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testSystemAudioCapture().catch(console.error);