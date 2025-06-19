#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Import the native module
const screencapturekit = require('../native/whisperdesk-screencapturekit');

async function testAudioCapture() {
    console.log('🧪 Testing Phase 3 - Audio Capture');
    console.log('=' .repeat(50));
    
    try {
        // Initialize the screen capture system
        console.log('🎵 Initializing ScreenCaptureKit for audio capture test...');
        const contentManager = new screencapturekit.ContentManager();
        
        // Get available displays (needed for screen capture even if focusing on audio)
        console.log('🔍 Getting shareable content...');
        const shareableContent = await contentManager.getShareableContent();
        
        if (!shareableContent || !shareableContent.displays || shareableContent.displays.length === 0) {
            throw new Error('No displays found');
        }
        
        const display = shareableContent.displays[0];
        console.log(`📱 Using display: ${display.name} (${display.width}x${display.height})`);
        
        // Create content filter
        console.log('🎯 Creating content filter...');
        const contentFilter = new screencapturekit.RealContentFilter();
        await contentFilter.initWithDisplay(display);
        
        // Create stream manager
        console.log('🚀 Creating stream manager with audio focus...');
        const streamManager = new screencapturekit.RealStreamManager();
        
        // Configure stream settings with emphasis on audio
        const streamConfig = {
            width: Math.min(display.width, 1280), // Lower resolution to focus on audio
            height: Math.min(display.height, 720),
            fps: 15, // Lower frame rate to focus on audio
            showsCursor: false,
            capturesAudio: true, // Enable audio capture
            pixelFormat: screencapturekit.kCVPixelFormatType_32BGRA,
            colorSpace: screencapturekit.kCGColorSpaceSRGB,
            // Audio encoding settings
            audioSampleRate: 48000, // High quality audio
            audioChannels: 2, // Stereo
            audioBitrate: 128000, // 128 kbps AAC
            audioCodec: 'aac'
        };
        
        console.log(`⚙️  Stream config: ${streamConfig.width}x${streamConfig.height} @ ${streamConfig.fps}fps`);
        console.log(`🎵 Audio config: ${streamConfig.audioSampleRate}Hz, ${streamConfig.audioChannels}ch, ${streamConfig.audioBitrate/1000}kbps`);
        
        // Create output directory
        const outputDir = path.join(__dirname, '..', 'test-output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputPath = path.join(outputDir, 'phase3-audio-capture-test');
        
        // Initialize stream with real delegate and audio encoder
        console.log('🎬 Initializing stream with audio encoder...');
        await streamManager.initializeStream(
            contentFilter,
            JSON.stringify(streamConfig),
            outputPath
        );
        
        // Start capture
        console.log('▶️  Starting audio capture...');
        await streamManager.startCapture();
        
        // Capture for 8 seconds to get meaningful audio
        console.log('⏱️  Recording audio for 8 seconds...');
        console.log('💡 Tip: Play some audio/music to generate audio samples');
        
        let audioSampleCount = 0;
        const startTime = Date.now();
        
        // Monitor audio capture progress
        const progressInterval = setInterval(() => {
            const statsJson = streamManager.getCaptureStats();
            const stats = JSON.parse(statsJson);
            const elapsed = (Date.now() - startTime) / 1000;
            console.log(`   📊 Progress: ${elapsed.toFixed(1)}s - Audio samples: ${stats.audioSamples}, Video frames: ${stats.videoFrames}`);
            audioSampleCount = stats.audioSamples;
        }, 1000);
        
        await new Promise(resolve => setTimeout(resolve, 8000));
        clearInterval(progressInterval);
        
        // Stop capture
        console.log('⏹️  Stopping audio capture...');
        await streamManager.stopCapture();
        
        // Get final capture statistics
        const statsJson = streamManager.getCaptureStats();
        const stats = JSON.parse(statsJson);
        console.log('\n📊 Final Audio Capture Statistics:');
        console.log(`   Audio samples captured: ${stats.audioSamples}`);
        console.log(`   Video frames captured: ${stats.videoFrames}`);
        console.log(`   Total duration: ${stats.duration}s`);
        console.log(`   Audio sample rate: ${(stats.audioSamples / stats.duration).toFixed(0)} samples/sec`);
        console.log(`   Output path: ${stats.outputPath}`);
        
        // Verify output files exist and analyze them
        const videoFile = `${outputPath}_video.mp4`;
        const audioFile = `${outputPath}_audio.mp4`;
        
        console.log('\n📁 Analyzing captured audio files:');
        
        if (fs.existsSync(audioFile)) {
            const audioStats = fs.statSync(audioFile);
            console.log(`   ✅ Audio file: ${path.basename(audioFile)}`);
            console.log(`      Size: ${(audioStats.size / 1024).toFixed(2)} KB`);
            console.log(`      Bitrate: ${((audioStats.size * 8) / stats.duration / 1000).toFixed(0)} kbps`);
            
            // Try to get audio info using ffprobe if available
            try {
                await analyzeAudioFile(audioFile);
            } catch (error) {
                console.log('      (ffprobe not available for detailed analysis)');
            }
        } else {
            console.log(`   ❌ Audio file not found: ${audioFile}`);
        }
        
        if (fs.existsSync(videoFile)) {
            const videoStats = fs.statSync(videoFile);
            console.log(`   ✅ Video file: ${path.basename(videoFile)}`);
            console.log(`      Size: ${(videoStats.size / 1024 / 1024).toFixed(2)} MB`);
        } else {
            console.log(`   ❌ Video file not found: ${videoFile}`);
        }
        
        // Validate audio capture quality
        console.log('\n🔍 Audio Capture Quality Validation:');
        
        if (stats.audioSamples > 0) {
            const expectedSamples = stats.duration * streamConfig.audioSampleRate;
            const audioEfficiency = (stats.audioSamples / expectedSamples) * 100;
            console.log(`   📈 Audio capture efficiency: ${audioEfficiency.toFixed(1)}%`);
            
            if (audioEfficiency > 80) {
                console.log('   ✅ Excellent audio capture rate');
            } else if (audioEfficiency > 60) {
                console.log('   ⚠️  Good audio capture rate');
            } else {
                console.log('   ❌ Poor audio capture rate - check audio system');
            }
        } else {
            console.log('   ❌ No audio samples captured');
            console.log('   💡 Make sure system audio is playing during capture');
        }
        
        if (fs.existsSync(audioFile)) {
            const audioStats = fs.statSync(audioFile);
            if (audioStats.size > 10 * 1024) { // > 10KB
                console.log('   ✅ Audio file has substantial content');
            } else {
                console.log('   ⚠️  Audio file is quite small - check audio encoding');
            }
        }
        
        // Test audio device detection
        console.log('\n🎤 Audio Device Detection:');
        try {
            const audioManager = new screencapturekit.AudioManager();
            const audioDevices = await audioManager.getAvailableAudioDevices();
            
            console.log(`   Found ${audioDevices.length} audio devices:`);
            audioDevices.forEach((device, index) => {
                console.log(`     ${index + 1}. ${device.name} (${device.type})`);
            });
        } catch (error) {
            console.log('   ⚠️  Could not enumerate audio devices:', error.message);
        }
        
        console.log('\n✅ Phase 3 Audio Capture Test Completed!');
        
        if (stats.audioSamples > 1000) {
            console.log(`🎉 Successfully captured ${stats.audioSamples} audio samples!`);
        } else {
            console.log('⚠️  Low audio sample count - check audio configuration');
        }
        
        if (fs.existsSync(audioFile)) {
            console.log(`🎵 Audio file created: ${path.basename(audioFile)}`);
            console.log('💡 You can play this file to verify audio quality');
        }
        
    } catch (error) {
        console.error('\n❌ Phase 3 Audio Capture Test Failed:');
        console.error(error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
        process.exit(1);
    }
}

async function analyzeAudioFile(audioFile) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            audioFile
        ]);
        
        let output = '';
        ffprobe.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        ffprobe.on('close', (code) => {
            if (code === 0) {
                try {
                    const info = JSON.parse(output);
                    const audioStream = info.streams.find(s => s.codec_type === 'audio');
                    
                    if (audioStream) {
                        console.log(`      Codec: ${audioStream.codec_name}`);
                        console.log(`      Sample rate: ${audioStream.sample_rate}Hz`);
                        console.log(`      Channels: ${audioStream.channels}`);
                        console.log(`      Duration: ${parseFloat(audioStream.duration).toFixed(2)}s`);
                        if (audioStream.bit_rate) {
                            console.log(`      Bitrate: ${Math.round(audioStream.bit_rate / 1000)} kbps`);
                        }
                    }
                    
                    if (info.format) {
                        console.log(`      Format: ${info.format.format_name}`);
                    }
                    
                    resolve();
                } catch (e) {
                    reject(e);
                }
            } else {
                reject(new Error(`ffprobe exited with code ${code}`));
            }
        });
        
        ffprobe.on('error', reject);
    });
}

// Run the test
if (require.main === module) {
    testAudioCapture().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { testAudioCapture }; 