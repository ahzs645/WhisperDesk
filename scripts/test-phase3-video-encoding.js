#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Import the native module
const screencapturekit = require('../native/whisperdesk-screencapturekit');

async function testVideoEncoding() {
    console.log('🧪 Testing Phase 3 - Video Encoding');
    console.log('=' .repeat(50));
    
    try {
        // Initialize the screen capture system
        console.log('📺 Initializing ScreenCaptureKit for video encoding test...');
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
        console.log('🚀 Creating stream manager with video encoder...');
        const streamManager = new screencapturekit.RealStreamManager();
        
        // Configure stream settings for high-quality encoding
        const streamConfig = {
            width: Math.min(display.width, 1920),
            height: Math.min(display.height, 1080),
            fps: 30,
            showsCursor: true,
            capturesAudio: true,
            pixelFormat: screencapturekit.kCVPixelFormatType_32BGRA,
            colorSpace: screencapturekit.kCGColorSpaceSRGB,
            // Video encoding settings
            videoCodec: 'h264', // H.264 encoding
            videoBitrate: streamConfig.width * streamConfig.height * 8, // 8 bits per pixel
            keyFrameInterval: 60 // Keyframe every 2 seconds at 30fps
        };
        
        console.log(`⚙️  Stream config: ${streamConfig.width}x${streamConfig.height} @ ${streamConfig.fps}fps`);
        console.log(`🎬 Video codec: ${streamConfig.videoCodec}, bitrate: ${streamConfig.videoBitrate}`);
        
        // Create output directory
        const outputDir = path.join(__dirname, '..', 'test-output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputPath = path.join(outputDir, 'phase3-video-encoding-test');
        
        // Initialize stream with real delegate and video encoder
        console.log('🎬 Initializing stream with video encoder...');
        await streamManager.initializeStream(
            contentFilter,
            JSON.stringify(streamConfig),
            outputPath
        );
        
        // Start capture
        console.log('▶️  Starting video encoding capture...');
        await streamManager.startCapture();
        
        // Capture for 10 seconds to get meaningful video
        console.log('⏱️  Recording video for 10 seconds...');
        let frameCount = 0;
        const startTime = Date.now();
        
        // Monitor frame capture progress
        const progressInterval = setInterval(() => {
            const statsJson = streamManager.getCaptureStats();
            const stats = JSON.parse(statsJson);
            const elapsed = (Date.now() - startTime) / 1000;
            console.log(`   📊 Progress: ${elapsed.toFixed(1)}s - Frames: ${stats.videoFrames}, Audio: ${stats.audioSamples}`);
            frameCount = stats.videoFrames;
        }, 1000);
        
        await new Promise(resolve => setTimeout(resolve, 10000));
        clearInterval(progressInterval);
        
        // Stop capture
        console.log('⏹️  Stopping video encoding...');
        await streamManager.stopCapture();
        
        // Get final capture statistics
        const statsJson = streamManager.getCaptureStats();
        const stats = JSON.parse(statsJson);
        console.log('\n📊 Final Encoding Statistics:');
        console.log(`   Video frames encoded: ${stats.videoFrames}`);
        console.log(`   Audio samples encoded: ${stats.audioSamples}`);
        console.log(`   Total duration: ${stats.duration}s`);
        console.log(`   Average FPS: ${(stats.videoFrames / stats.duration).toFixed(2)}`);
        console.log(`   Output path: ${stats.outputPath}`);
        
        // Verify output files exist and analyze them
        const videoFile = `${outputPath}_video.mp4`;
        const audioFile = `${outputPath}_audio.mp4`;
        
        console.log('\n📁 Analyzing encoded files:');
        
        if (fs.existsSync(videoFile)) {
            const videoStats = fs.statSync(videoFile);
            console.log(`   ✅ Video file: ${path.basename(videoFile)}`);
            console.log(`      Size: ${(videoStats.size / 1024 / 1024).toFixed(2)} MB`);
            console.log(`      Bitrate: ${((videoStats.size * 8) / stats.duration / 1000).toFixed(0)} kbps`);
            
            // Try to get video info using ffprobe if available
            try {
                await analyzeVideoFile(videoFile);
            } catch (error) {
                console.log('      (ffprobe not available for detailed analysis)');
            }
        } else {
            console.log(`   ❌ Video file not found: ${videoFile}`);
        }
        
        if (fs.existsSync(audioFile)) {
            const audioStats = fs.statSync(audioFile);
            console.log(`   ✅ Audio file: ${path.basename(audioFile)}`);
            console.log(`      Size: ${(audioStats.size / 1024).toFixed(2)} KB`);
        } else {
            console.log(`   ❌ Audio file not found: ${audioFile}`);
        }
        
        // Validate encoding quality
        console.log('\n🔍 Encoding Quality Validation:');
        
        if (stats.videoFrames > 0) {
            const expectedFrames = stats.duration * streamConfig.fps;
            const frameEfficiency = (stats.videoFrames / expectedFrames) * 100;
            console.log(`   📈 Frame capture efficiency: ${frameEfficiency.toFixed(1)}%`);
            
            if (frameEfficiency > 80) {
                console.log('   ✅ Excellent frame capture rate');
            } else if (frameEfficiency > 60) {
                console.log('   ⚠️  Good frame capture rate');
            } else {
                console.log('   ❌ Poor frame capture rate - check performance');
            }
        }
        
        if (fs.existsSync(videoFile)) {
            const videoStats = fs.statSync(videoFile);
            if (videoStats.size > 1024 * 1024) { // > 1MB
                console.log('   ✅ Video file has substantial content');
            } else {
                console.log('   ⚠️  Video file is quite small - check encoding');
            }
        }
        
        console.log('\n✅ Phase 3 Video Encoding Test Completed!');
        
        if (stats.videoFrames > 100) {
            console.log(`🎉 Successfully encoded ${stats.videoFrames} frames to MP4!`);
        } else {
            console.log('⚠️  Low frame count - check encoder implementation');
        }
        
    } catch (error) {
        console.error('\n❌ Phase 3 Video Encoding Test Failed:');
        console.error(error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
        process.exit(1);
    }
}

async function analyzeVideoFile(videoFile) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            videoFile
        ]);
        
        let output = '';
        ffprobe.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        ffprobe.on('close', (code) => {
            if (code === 0) {
                try {
                    const info = JSON.parse(output);
                    const videoStream = info.streams.find(s => s.codec_type === 'video');
                    
                    if (videoStream) {
                        console.log(`      Codec: ${videoStream.codec_name}`);
                        console.log(`      Resolution: ${videoStream.width}x${videoStream.height}`);
                        console.log(`      Frame rate: ${videoStream.r_frame_rate}`);
                        console.log(`      Duration: ${parseFloat(videoStream.duration).toFixed(2)}s`);
                    }
                    
                    if (info.format) {
                        console.log(`      Format: ${info.format.format_name}`);
                        if (info.format.bit_rate) {
                            console.log(`      Bitrate: ${Math.round(info.format.bit_rate / 1000)} kbps`);
                        }
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
    testVideoEncoding().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { testVideoEncoding }; 