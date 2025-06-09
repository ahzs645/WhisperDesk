// src/main/services/screen-recorder.js - FIXED VERSION 2
const { desktopCapturer, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');

class EnhancedScreenRecorder extends EventEmitter {
    constructor() {
        super();
        this.isRecording = false;
        this.isPaused = false;
        this.recordingProcess = null;
        this.outputPath = null;
        this.audioOutputPath = null;
        this.recordingStartTime = null;
        this.platform = os.platform();
        this.recordingsDir = this.getRecordingsDirectory();
        this.ffmpegPath = this.getFFmpegPath();
        this.availableDevices = null;
    }

    async initialize() {
        try {
            await fs.mkdir(this.recordingsDir, { recursive: true });
            await this.checkPermissions();
            await this.verifyFFmpeg();
            
            // FIXED: Get available devices during initialization
            await this.detectAvailableDevices();
            
            console.log('Enhanced screen recorder initialized');
        } catch (error) {
            console.error('Failed to initialize screen recorder:', error);
            throw error;
        }
    }

    getRecordingsDirectory() {
        const homeDir = os.homedir();
        switch (this.platform) {
            case 'darwin':
                return path.join(homeDir, 'Movies', 'WhisperDesk');
            case 'win32':
                return path.join(homeDir, 'Videos', 'WhisperDesk');
            default:
                return path.join(homeDir, 'Videos', 'WhisperDesk');
        }
    }

    getFFmpegPath() {
        try {
            return require('ffmpeg-static');
        } catch (error) {
            return 'ffmpeg';
        }
    }

    async checkPermissions() {
        if (this.platform === 'darwin') {
            return this.checkMacPermissions();
        }
        return true;
    }

    async checkMacPermissions() {
        try {
            const screenAccess = systemPreferences.getMediaAccessStatus('screen');
            console.log('macOS screen access status:', screenAccess);

            if (screenAccess !== 'granted') {
                await systemPreferences.askForMediaAccess('screen');
                const newStatus = systemPreferences.getMediaAccessStatus('screen');
                if (newStatus !== 'granted') {
                    throw new Error('Screen recording permission not granted');
                }
            }

            const micAccess = systemPreferences.getMediaAccessStatus('microphone');
            if (micAccess !== 'granted') {
                await systemPreferences.askForMediaAccess('microphone');
            }

            return true;
        } catch (error) {
            console.error('macOS permission check failed:', error);
            throw error;
        }
    }

    async verifyFFmpeg() {
        return new Promise((resolve, reject) => {
            const process = spawn(this.ffmpegPath, ['-version']);
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error('FFmpeg not available'));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`FFmpeg error: ${error.message}`));
            });

            setTimeout(() => {
                process.kill();
                reject(new Error('FFmpeg verification timeout'));
            }, 5000);
        });
    }

    // FIXED: Properly detect available devices
    async detectAvailableDevices() {
        if (this.platform !== 'darwin') {
            this.availableDevices = { screens: ['0'], audio: ['0'] };
            return;
        }

        return new Promise((resolve, reject) => {
            // List all available AVFoundation devices
            const listProcess = spawn(this.ffmpegPath, [
                '-f', 'avfoundation', 
                '-list_devices', 'true', 
                '-i', ''
            ]);

            let output = '';
            let errorOutput = '';

            listProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            listProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            listProcess.on('close', (code) => {
                console.log('Device detection output:', errorOutput);
                
                // Parse the device list from stderr (FFmpeg outputs device list to stderr)
                const devices = this.parseAVFoundationDevices(errorOutput);
                this.availableDevices = devices;
                
                console.log('Detected devices:', devices);
                resolve(devices);
            });

            listProcess.on('error', (error) => {
                console.error('Device detection failed:', error);
                // Fallback to default devices
                this.availableDevices = { screens: ['0'], audio: ['0'] };
                resolve(this.availableDevices);
            });

            setTimeout(() => {
                listProcess.kill();
                this.availableDevices = { screens: ['0'], audio: ['0'] };
                resolve(this.availableDevices);
            }, 10000);
        });
    }

    parseAVFoundationDevices(output) {
        const devices = { screens: [], audio: [] };
        const lines = output.split('\n');
        let currentSection = null;

        for (const line of lines) {
            if (line.includes('AVFoundation video devices:')) {
                currentSection = 'video';
                continue;
            }
            if (line.includes('AVFoundation audio devices:')) {
                currentSection = 'audio';
                continue;
            }

            // Parse device lines like: [0] Capture screen 0
            const deviceMatch = line.match(/\[(\d+)\]\s+(.+)/);
            if (deviceMatch && currentSection) {
                const deviceId = deviceMatch[1];
                const deviceName = deviceMatch[2];
                
                if (currentSection === 'video' && deviceName.toLowerCase().includes('screen')) {
                    devices.screens.push(deviceId);
                } else if (currentSection === 'audio') {
                    devices.audio.push(deviceId);
                }
            }
        }

        // Ensure we have at least default devices
        if (devices.screens.length === 0) devices.screens.push('0');
        if (devices.audio.length === 0) devices.audio.push('0');

        return devices;
    }

    async getAvailableScreens() {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 150, height: 150 }
            });

            return sources.map(source => ({
                id: source.id,
                name: source.name,
                thumbnail: source.thumbnail?.toDataURL?.()
            }));
        } catch (error) {
            console.error('Failed to get available screens:', error);
            return [{ id: 'default', name: 'Default Screen', thumbnail: null }];
        }
    }

    async startRecording(options = {}) {
        if (this.isRecording) {
            throw new Error('Recording is already in progress');
        }

        const {
            screenId = 'default',
            includeMicrophone = true,
            includeSystemAudio = false, // Default to false as it's complex
            audioQuality = 'medium',
            videoQuality = 'medium',
            audioPath = null
        } = options;

        try {
            await this.checkPermissions();

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            this.outputPath = path.join(this.recordingsDir, `recording-${timestamp}.mp4`);
            this.audioOutputPath = audioPath || path.join(this.recordingsDir, `audio-${timestamp}.wav`);

            const ffmpegArgs = await this.buildFFmpegArgs({
                screenId,
                includeMicrophone,
                includeSystemAudio,
                audioQuality,
                videoQuality,
                outputPath: this.outputPath,
                audioPath: this.audioOutputPath
            });

            console.log('Starting screen recording with args:', ffmpegArgs);

            this.recordingProcess = spawn(this.ffmpegPath, ffmpegArgs, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // FIXED: Proper event handler setup
            this.setupRecordingHandlers();
            
            // FIXED: Set state immediately after starting process
            this.isRecording = true;
            this.isPaused = false;
            this.recordingStartTime = Date.now();

            this.emit('started', { 
                outputPath: this.outputPath,
                audioPath: this.audioOutputPath 
            });

            return {
                success: true,
                outputPath: this.outputPath,
                audioPath: this.audioOutputPath,
                message: 'Screen recording started successfully'
            };

        } catch (error) {
            this.cleanup();
            throw error;
        }
    }

    async buildFFmpegArgs(options) {
        const {
            screenId,
            includeMicrophone,
            includeSystemAudio,
            audioQuality,
            videoQuality,
            outputPath,
            audioPath
        } = options;

        let args = ['-y']; // Overwrite output files

        switch (this.platform) {
            case 'darwin':
                args = args.concat(await this.buildMacOSArgs(options));
                break;
            case 'win32':
                args = args.concat(await this.buildWindowsArgs(options));
                break;
            default:
                args = args.concat(await this.buildLinuxArgs(options));
                break;
        }

        // Add output quality settings
        args = args.concat(this.getQualitySettings(videoQuality, audioQuality));
        
        // Main video output
        args.push(outputPath);

        // FIXED: Only add audio output if we have microphone
        if (audioPath && includeMicrophone) {
            args.push('-map', '0:a', '-c:a', 'pcm_s16le', '-ar', '16000', '-ac', '1', audioPath);
        }

        return args;
    }

    async buildMacOSArgs(options) {
        const { screenId, includeMicrophone, includeSystemAudio } = options;
        let args = [];

        // Use detected devices or fallback
        const screenDevice = this.availableDevices?.screens?.[0] || '0';
        const audioDevice = this.availableDevices?.audio?.[0] || '0';

        args.push('-f', 'avfoundation');
        
        if (includeMicrophone) {
            // FIXED: Use detected screen and audio device
            args.push('-i', `${screenDevice}:${audioDevice}`);
            console.log(`Using screen device ${screenDevice} and audio device ${audioDevice}`);
        } else {
            // Screen only, no audio
            args.push('-i', `${screenDevice}:none`);
            console.log(`Using screen device ${screenDevice} with no audio`);
        }

        // FIXED: Proper video settings for macOS
        args.push('-c:v', 'libx264');
        args.push('-pix_fmt', 'yuv420p');
        args.push('-r', '30'); // Fixed framerate to exactly 30
        args.push('-video_size', '1920x1080'); // Set explicit video size

        return args;
    }

    async buildWindowsArgs(options) {
        const { includeMicrophone, includeSystemAudio } = options;
        let args = [];

        args.push('-f', 'gdigrab');
        args.push('-framerate', '30');
        args.push('-offset_x', '0');
        args.push('-offset_y', '0');
        args.push('-video_size', '1920x1080');
        args.push('-i', 'desktop');

        if (includeMicrophone) {
            args.push('-f', 'dshow');
            args.push('-i', 'audio="Default Audio Device"');
        }

        return args;
    }

    async buildLinuxArgs(options) {
        const { includeMicrophone, includeSystemAudio } = options;
        let args = [];

        const display = process.env.DISPLAY || ':0';
        
        args.push('-f', 'x11grab');
        args.push('-framerate', '30');
        args.push('-video_size', '1920x1080');
        args.push('-i', display + '+0,0');

        if (includeMicrophone) {
            args.push('-f', 'pulse');
            args.push('-i', 'default');
        }

        return args;
    }

    getQualitySettings(videoQuality, audioQuality) {
        const settings = [];

        // Video quality settings
        switch (videoQuality) {
            case 'low':
                settings.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28');
                break;
            case 'medium':
                settings.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23');
                break;
            case 'high':
                settings.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18');
                break;
            default:
                settings.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23');
        }

        // Audio quality settings
        switch (audioQuality) {
            case 'low':
                settings.push('-c:a', 'aac', '-b:a', '128k');
                break;
            case 'medium':
                settings.push('-c:a', 'aac', '-b:a', '192k');
                break;
            case 'high':
                settings.push('-c:a', 'aac', '-b:a', '256k');
                break;
            default:
                settings.push('-c:a', 'aac', '-b:a', '192k');
        }

        return settings;
    }

    // FIXED: Proper event handler setup with error handling
    setupRecordingHandlers() {
        this.recordingProcess.stdout.on('data', (data) => {
            console.log('FFmpeg stdout:', data.toString());
        });

        this.recordingProcess.stderr.on('data', (data) => {
            const output = data.toString();
            console.log('FFmpeg stderr:', output);
            this.parseProgress(output);
        });

        this.recordingProcess.on('close', (code) => {
            console.log(`Recording process exited with code ${code}`);
            const wasRecording = this.isRecording;
            this.isRecording = false;
            this.isPaused = false;

            if (code === 0) {
                this.emit('completed', {
                    outputPath: this.outputPath,
                    audioPath: this.audioOutputPath,
                    duration: Date.now() - this.recordingStartTime
                });
            } else if (wasRecording) {
                // Only emit error if we were actually recording
                this.emit('error', {
                    error: `Recording process failed with code ${code}`,
                    outputPath: this.outputPath
                });
            }
        });

        this.recordingProcess.on('error', (error) => {
            console.error('Recording process error:', error);
            this.isRecording = false;
            this.isPaused = false;
            this.emit('error', { error: error.message });
            this.cleanup();
        });
    }

    parseProgress(output) {
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.\d{2}/);
        if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseInt(timeMatch[3]);
            const totalSeconds = hours * 3600 + minutes * 60 + seconds;
            
            this.emit('progress', {
                duration: totalSeconds,
                timestamp: Date.now()
            });
        }
    }

    // FIXED: Better pause/resume implementation
    pauseRecording() {
        console.log('Pause requested - isRecording:', this.isRecording, 'isPaused:', this.isPaused);
        
        if (!this.isRecording || !this.recordingProcess) {
            return { success: false, error: 'Not recording' };
        }
        
        if (this.isPaused) {
            return { success: false, error: 'Already paused' };
        }

        try {
            // For macOS/Linux: Use SIGSTOP to pause the process
            if (this.platform !== 'win32') {
                this.recordingProcess.kill('SIGSTOP');
            } else {
                // For Windows: We can't easily pause FFmpeg, so return error
                return { success: false, error: 'Pause not supported on Windows' };
            }
            
            this.isPaused = true;
            this.emit('paused');
            return { success: true };
        } catch (err) {
            console.error('Pause failed:', err);
            return { success: false, error: err.message };
        }
    }

    resumeRecording() {
        console.log('Resume requested - isRecording:', this.isRecording, 'isPaused:', this.isPaused);
        
        if (!this.isRecording || !this.recordingProcess) {
            return { success: false, error: 'Not recording' };
        }
        
        if (!this.isPaused) {
            return { success: false, error: 'Not paused' };
        }

        try {
            // For macOS/Linux: Use SIGCONT to resume the process
            if (this.platform !== 'win32') {
                this.recordingProcess.kill('SIGCONT');
            } else {
                return { success: false, error: 'Resume not supported on Windows' };
            }
            
            this.isPaused = false;
            this.emit('resumed');
            return { success: true };
        } catch (err) {
            console.error('Resume failed:', err);
            return { success: false, error: err.message };
        }
    }

    async stopRecording() {
        console.log('Stop requested - isRecording:', this.isRecording, 'process exists:', !!this.recordingProcess);
        
        if (!this.isRecording || !this.recordingProcess) {
            throw new Error('No recording in progress');
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.recordingProcess) {
                    this.recordingProcess.kill('SIGKILL');
                }
                this.cleanup();
                reject(new Error('Recording stop timeout'));
            }, 10000);

            // FIXED: Better completion handling
            const handleClose = (code) => {
                clearTimeout(timeout);
                const result = {
                    success: true,
                    outputPath: this.outputPath,
                    audioPath: this.audioOutputPath,
                    duration: this.recordingStartTime ? Date.now() - this.recordingStartTime : 0
                };
                this.cleanup();
                resolve(result);
            };

            const handleError = (error) => {
                clearTimeout(timeout);
                this.cleanup();
                reject(error);
            };

            this.recordingProcess.once('close', handleClose);
            this.recordingProcess.once('error', handleError);

            // Send graceful termination signal
            try {
                if (this.platform === 'win32') {
                    this.recordingProcess.stdin.write('q\n');
                } else {
                    // If paused, resume first
                    if (this.isPaused) {
                        this.recordingProcess.kill('SIGCONT');
                    }
                    this.recordingProcess.kill('SIGTERM');
                }
            } catch (err) {
                console.error('Error sending stop signal:', err);
                this.recordingProcess.kill('SIGKILL');
            }
        });
    }

    getStatus() {
        return {
            isRecording: this.isRecording,
            isPaused: this.isPaused,
            duration: this.isRecording && this.recordingStartTime ? Date.now() - this.recordingStartTime : 0,
            outputPath: this.outputPath,
            audioPath: this.audioOutputPath,
            recordingsDirectory: this.recordingsDir,
            availableDevices: this.availableDevices
        };
    }

    cleanup() {
        this.isRecording = false;
        this.isPaused = false;
        this.recordingProcess = null;
        this.outputPath = null;
        this.audioOutputPath = null;
        this.recordingStartTime = null;
    }

    // Additional methods remain the same...
    async getRecordings() {
        try {
            const files = await fs.readdir(this.recordingsDir);
            const recordings = [];

            for (const file of files) {
                if (file.endsWith('.mp4') || file.endsWith('.wav')) {
                    const filePath = path.join(this.recordingsDir, file);
                    const stats = await fs.stat(filePath);
                    
                    recordings.push({
                        name: file,
                        path: filePath,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    });
                }
            }

            return recordings.sort((a, b) => b.created - a.created);
        } catch (error) {
            console.error('Error getting recordings:', error);
            return [];
        }
    }

    async deleteRecording(filePath) {
        try {
            await fs.unlink(filePath);
            return { success: true };
        } catch (error) {
            throw new Error(`Failed to delete recording: ${error.message}`);
        }
    }
}

module.exports = EnhancedScreenRecorder;