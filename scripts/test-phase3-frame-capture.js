#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Import the native module
const screencapturekit = require('../native/whisperdesk-screencapturekit');

async function testFrameCapture() {
    console.log('🧪 Testing Phase 3 - Real Frame Capture');
    console.log('=' .repeat(50));
    
    try {
        // Initialize the screen capture system
        console.log('📺 Initializing ScreenCaptureKit...');
        const contentManager = new screencapturekit.ContentManager();
        
        // Get available displays
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
        console.log('🚀 Creating stream manager...');
        const streamManager = new screencapturekit.RealStreamManager();
        
        // Configure stream settings
        const streamConfig = {
            width: Math.min(display.width, 1920),
            height: Math.min(display.height, 1080),
            fps: 30,
            showsCursor: true,
            capturesAudio: true,
            pixelFormat: screencapturekit.kCVPixelFormatType_32BGRA,
            colorSpace: screencapturekit.kCGColorSpaceSRGB
        };
        
        console.log(`⚙️  Stream config: ${streamConfig.width}x${streamConfig.height} @ ${streamConfig.fps}fps`);
        
        // Create output directory
        const outputDir = path.join(__dirname, '..', 'test-output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputPath = path.join(outputDir, 'phase3-frame-test');
        
        // Initialize stream with real delegate
        console.log('🎬 Initializing stream with real delegate...');
        await streamManager.initializeStream(
            contentFilter,
            JSON.stringify(streamConfig),
            outputPath
        );
        
        // Start capture
        console.log('▶️  Starting frame capture...');
        await streamManager.startCapture();
        
        // Capture for 5 seconds
        console.log('⏱️  Capturing frames for 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Stop capture
        console.log('⏹️  Stopping capture...');
        await streamManager.stopCapture();
        
        // Get capture statistics
        const statsJson = streamManager.getCaptureStats();
        const stats = JSON.parse(statsJson);
        console.log('\n📊 Capture Statistics:');
        console.log(`   Video frames: ${stats.videoFrames}`);
        console.log(`   Audio samples: ${stats.audioSamples}`);
        console.log(`   Duration: ${stats.duration}s`);
        console.log(`   Output path: ${stats.outputPath}`);
        
        // Verify output files exist
        const videoFile = `${outputPath}_video.mp4`;
        const audioFile = `${outputPath}_audio.mp4`;
        
        console.log('\n📁 Checking output files:');
        if (fs.existsSync(videoFile)) {
            const videoStats = fs.statSync(videoFile);
            console.log(`   ✅ Video file: ${videoFile} (${videoStats.size} bytes)`);
        } else {
            console.log(`   ❌ Video file not found: ${videoFile}`);
        }
        
        if (fs.existsSync(audioFile)) {
            const audioStats = fs.statSync(audioFile);
            console.log(`   ✅ Audio file: ${audioFile} (${audioStats.size} bytes)`);
        } else {
            console.log(`   ❌ Audio file not found: ${audioFile}`);
        }
        
        console.log('\n✅ Phase 3 Frame Capture Test Completed Successfully!');
        
        if (stats.videoFrames > 0) {
            console.log(`🎉 Successfully captured ${stats.videoFrames} video frames!`);
        } else {
            console.log('⚠️  No video frames captured - check delegate implementation');
        }
        
        if (stats.audioSamples > 0) {
            console.log(`🎉 Successfully captured ${stats.audioSamples} audio samples!`);
        } else {
            console.log('⚠️  No audio samples captured - check audio configuration');
        }
        
    } catch (error) {
        console.error('\n❌ Phase 3 Frame Capture Test Failed:');
        console.error(error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testFrameCapture().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { testFrameCapture }; 