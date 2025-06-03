const { desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');

class ScreenRecorder {
    constructor() {
        this.isRecording = false;
        this.outputPath = null;
        this.ffmpegProcess = null;
        this.recordingStartTime = null;
    }

    async initialize() {
        // No need to register IPC handlers here as they are registered in the main process
        console.log('Screen recorder service initialized');
    }

    async startRecording(options) {
        if (this.isRecording) {
            throw new Error('Recording is already in progress');
        }

        const { includeMicrophone = true, includeSystemAudio = true } = options;

        // Create recordings directory in user's home directory
        const homeDir = process.env.HOME || process.env.USERPROFILE;
        const outputDirectory = path.join(homeDir, 'WhisperDesk', 'Recordings');
        
        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDirectory)) {
            fs.mkdirSync(outputDirectory, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.outputPath = path.join(outputDirectory, `recording-${timestamp}.mp4`);

        // Get screen sources
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 0, height: 0 }
        });

        if (sources.length === 0) {
            throw new Error('No screen sources found');
        }

        // Prepare FFmpeg command based on platform
        let ffmpegArgs;
        if (process.platform === 'darwin') {
            // macOS
            ffmpegArgs = [
                '-f', 'avfoundation',
                '-i', `${sources[0].id}:${includeSystemAudio ? '1' : 'none'}`,
                '-f', 'avfoundation',
                '-i', `${includeMicrophone ? '1' : 'none'}:none`,
                '-filter_complex', 'amix=inputs=2:duration=first:dropout_transition=2',
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-c:a', 'aac',
                '-b:a', '192k',
                this.outputPath
            ];
        } else if (process.platform === 'win32') {
            // Windows
            ffmpegArgs = [
                '-f', 'gdigrab',
                '-i', 'desktop',
                '-f', 'dshow',
                '-i', `audio=${includeSystemAudio ? 'virtual-audio-capturer' : 'none'}`,
                '-f', 'dshow',
                '-i', `audio=${includeMicrophone ? 'microphone' : 'none'}`,
                '-filter_complex', 'amix=inputs=2:duration=first:dropout_transition=2',
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-c:a', 'aac',
                '-b:a', '192k',
                this.outputPath
            ];
        } else {
            // Linux
            ffmpegArgs = [
                '-f', 'x11grab',
                '-i', ':0.0',
                '-f', 'alsa',
                '-i', includeSystemAudio ? 'default' : 'null',
                '-f', 'alsa',
                '-i', includeMicrophone ? 'hw:0,0' : 'null',
                '-filter_complex', 'amix=inputs=2:duration=first:dropout_transition=2',
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-c:a', 'aac',
                '-b:a', '192k',
                this.outputPath
            ];
        }

        // Start FFmpeg process
        this.ffmpegProcess = spawn(ffmpeg, ffmpegArgs);
        this.isRecording = true;
        this.recordingStartTime = Date.now();

        // Handle FFmpeg process events
        this.ffmpegProcess.on('error', (error) => {
            console.error('FFmpeg error:', error);
            this.isRecording = false;
        });

        this.ffmpegProcess.on('close', (code) => {
            console.log(`FFmpeg process exited with code ${code}`);
            this.isRecording = false;
        });

        return {
            success: true,
            outputPath: this.outputPath
        };
    }

    async stopRecording() {
        if (!this.isRecording) {
            throw new Error('No recording in progress');
        }

        return new Promise((resolve, reject) => {
            if (this.ffmpegProcess) {
                this.ffmpegProcess.on('close', (code) => {
                    this.isRecording = false;
                    this.ffmpegProcess = null;
                    resolve({
                        success: true,
                        outputPath: this.outputPath
                    });
                });

                // Send 'q' to FFmpeg to stop recording gracefully
                this.ffmpegProcess.stdin.write('q');
            } else {
                reject(new Error('No FFmpeg process found'));
            }
        });
    }
}

module.exports = ScreenRecorder; 