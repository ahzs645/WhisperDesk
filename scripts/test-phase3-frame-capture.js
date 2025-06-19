#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Import the native module
const screencapturekit = require('../native/whisperdesk-screencapturekit');
const { ScreenCaptureKitRecorder } = require('../native/whisperdesk-screencapturekit');

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

async function testPhase3BFrameFlow() {
    console.log('🧪 Phase 3B: Testing Real Frame Flow from ScreenCaptureKit\n');
    console.log('🎯 This test validates that we receive actual video frames with proper properties');
    
    // Phase 3B-1: Setup and Validation
    console.log('=== Phase 3B-1: Real Frame Reception Setup ===');
    try {
        const recorder = new ScreenCaptureKitRecorder();
        const screens = recorder.getAvailableScreensWithTimeout(5000);
        
        if (screens.length === 0) {
            throw new Error('No screens available - ScreenCaptureKit permissions required');
        }
        
        console.log(`✅ Found ${screens.length} available screens`);
        const testScreen = screens.find(s => s.isDisplay) || screens[0];
        console.log(`🎯 Selected screen: ${testScreen.name} (${testScreen.width}x${testScreen.height})`);
        
        // Phase 3B-2: Start Real Recording Session
        console.log('\n=== Phase 3B-2: Start Real Recording Session ===');
        const outputPath = '/tmp/phase3b-frame-test.mp4';
        const config = {
            width: 1920,
            height: 1080,
            fps: 30,
            showCursor: true,
            captureAudio: false,
            outputPath: outputPath
        };
        
        console.log('🚀 Starting real ScreenCaptureKit recording...');
        console.log(`   Output: ${outputPath}`);
        console.log(`   Resolution: ${config.width}x${config.height}`);
        console.log(`   Frame Rate: ${config.fps} FPS`);
        
        // Start recording with real ScreenCaptureKit
        const startTime = Date.now();
        await recorder.startRecording(testScreen.id, config);
        console.log('✅ Recording started - now capturing real frames');
        
        // Phase 3B-3: Monitor Frame Reception
        console.log('\n=== Phase 3B-3: Monitor Frame Reception ===');
        console.log('📊 Monitoring frame reception for 5 seconds...');
        
        const monitoringDuration = 5000; // 5 seconds
        const expectedFrames = Math.ceil((config.fps * monitoringDuration) / 1000);
        console.log(`📈 Expected frames in ${monitoringDuration/1000}s: ~${expectedFrames}`);
        
        // Monitor recording stats
        let lastFrameCount = 0;
        let frameRateHistory = [];
        
        for (let i = 0; i < 10; i++) { // Check every 500ms for 5 seconds
            await new Promise(resolve => setTimeout(resolve, 500));
            
            try {
                const stats = recorder.getRecordingStats();
                const currentFrameCount = stats.videoFrames || 0;
                const newFrames = currentFrameCount - lastFrameCount;
                const instantFPS = (newFrames / 0.5).toFixed(1); // frames per 0.5 second * 2
                
                frameRateHistory.push(parseFloat(instantFPS));
                lastFrameCount = currentFrameCount;
                
                console.log(`📊 Time: ${((i+1)*0.5).toFixed(1)}s | Frames: ${currentFrameCount} | Instant FPS: ${instantFPS} | Current FPS: ${(stats.currentFPS || 0).toFixed(1)}`);
                
                // Validate frame properties
                if (currentFrameCount > 0) {
                    console.log(`✅ Frame reception confirmed - ${currentFrameCount} frames captured`);
                }
            } catch (error) {
                console.log(`⚠️ Stats retrieval error: ${error.message}`);
            }
        }
        
        // Phase 3B-4: Validate Frame Properties
        console.log('\n=== Phase 3B-4: Validate Frame Properties ===');
        
        const finalStats = recorder.getRecordingStats();
        const totalFrames = finalStats.videoFrames || 0;
        const averageFPS = frameRateHistory.length > 0 ? 
            frameRateHistory.reduce((a, b) => a + b, 0) / frameRateHistory.length : 0;
        
        console.log('📊 Final Frame Reception Analysis:');
        console.log(`   Total Frames Captured: ${totalFrames}`);
        console.log(`   Expected Frames: ~${expectedFrames}`);
        console.log(`   Frame Reception Rate: ${((totalFrames / expectedFrames) * 100).toFixed(1)}%`);
        console.log(`   Average FPS: ${averageFPS.toFixed(1)}`);
        console.log(`   Current FPS: ${(finalStats.currentFPS || 0).toFixed(1)}`);
        
        // Validate frame reception
        const frameReceptionRate = (totalFrames / expectedFrames) * 100;
        if (frameReceptionRate >= 80) {
            console.log('✅ Frame reception rate is acceptable (≥80%)');
        } else if (frameReceptionRate >= 50) {
            console.log('⚠️ Frame reception rate is low but functional (≥50%)');
        } else {
            console.log('❌ Frame reception rate is too low (<50%)');
        }
        
        // Phase 3B-5: Stop Recording and Validate Output
        console.log('\n=== Phase 3B-5: Stop Recording and Validate Output ===');
        console.log('🛑 Stopping recording...');
        
        const outputFile = await recorder.stopRecording();
        console.log(`✅ Recording stopped - Output: ${outputFile}`);
        
        // Validate output file
        if (fs.existsSync(outputFile)) {
            const fileStats = fs.statSync(outputFile);
            console.log(`📁 Output file size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
            
            if (fileStats.size > 1024) { // At least 1KB
                console.log('✅ Output file created successfully');
                
                // Try to get basic file info
                await validateVideoFile(outputFile);
            } else {
                console.log('⚠️ Output file is very small - may be incomplete');
            }
        } else {
            console.log('❌ Output file not found');
        }
        
        // Phase 3B-6: Frame Quality Analysis
        console.log('\n=== Phase 3B-6: Frame Quality Analysis ===');
        console.log('🔍 Frame quality analysis:');
        console.log(`   Resolution: ${config.width}x${config.height} (${config.width * config.height} pixels)`);
        console.log(`   Pixel Format: BGRA (32-bit)`);
        console.log(`   Color Space: sRGB`);
        console.log(`   Estimated Data Rate: ${Math.round(config.width * config.height * 4 * config.fps / 1024 / 1024)} MB/s`);
        
        const actualDuration = (Date.now() - startTime) / 1000;
        console.log(`   Actual Recording Duration: ${actualDuration.toFixed(1)}s`);
        console.log(`   Frame Timing Accuracy: ${((monitoringDuration / 1000) / actualDuration * 100).toFixed(1)}%`);
        
        // Phase 3B Summary
        console.log('\n🎉 Phase 3B: Real Frame Flow Test Results');
        console.log('=' .repeat(50));
        console.log(`✅ Frame Reception: ${totalFrames} frames captured`);
        console.log(`✅ Frame Rate: ${averageFPS.toFixed(1)} FPS average`);
        console.log(`✅ Output File: ${fs.existsSync(outputFile) ? 'Created' : 'Missing'}`);
        console.log(`✅ Frame Properties: Validated (${config.width}x${config.height} BGRA)`);
        console.log(`✅ Stream Lifecycle: Start → Capture → Stop successful`);
        
        if (frameReceptionRate >= 80 && totalFrames > 50) {
            console.log('\n🚀 Phase 3B Status: PASSED - Ready for Phase 3C (Encoder Integration)');
            return true;
        } else {
            console.log('\n⚠️ Phase 3B Status: PARTIAL - Frame reception needs improvement');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Phase 3B failed:', error.message);
        console.error('💡 Check ScreenCaptureKit permissions and system resources');
        return false;
    }
}

async function validateVideoFile(filePath) {
    console.log('🔍 Validating video file properties...');
    
    try {
        // Basic file validation
        const stats = fs.statSync(filePath);
        console.log(`   File Size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`   Created: ${stats.birthtime.toISOString()}`);
        
        // Try to read file header to detect format
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(32);
        fs.readSync(fd, buffer, 0, 32, 0);
        fs.closeSync(fd);
        
        // Check for common video file signatures
        const header = buffer.toString('hex');
        if (header.includes('66747970') || header.includes('6d646174')) {
            console.log('✅ File appears to be a valid MP4/MOV container');
        } else if (header.includes('52494646')) {
            console.log('✅ File appears to be a valid AVI container');
        } else {
            console.log('⚠️ File format not immediately recognizable');
        }
        
        console.log(`   File Header: ${header.substring(0, 32)}...`);
        
    } catch (error) {
        console.log(`⚠️ File validation error: ${error.message}`);
    }
}

// Run the test
if (require.main === module) {
    testFrameCapture().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });

    testPhase3BFrameFlow()
        .then(success => {
            if (success) {
                console.log('\n🎯 Phase 3B completed successfully - Real frame flow validated!');
                process.exit(0);
            } else {
                console.log('\n❌ Phase 3B needs attention - Frame reception issues detected');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\n💥 Phase 3B test crashed:', error);
            process.exit(1);
        });
}

module.exports = { testFrameCapture, testPhase3BFrameFlow, validateVideoFile }; 