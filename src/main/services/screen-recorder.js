// src/main/services/screen-recorder.js - COMPREHENSIVE FIX
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
        this.lastError = null;
        
        // NEW: Add process monitoring
        this.processMonitorInterval = null;
        this.recordingValidated = false;
        this.startupTimeout = null;
    }

    async initialize() {
        try {
            await fs.mkdir(this.recordingsDir, { recursive: true });
            await this.checkPermissions();
            await this.verifyFFmpeg();
            
            // Get available devices during initialization
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

    async detectAvailableDevices() {
        if (this.platform !== 'darwin') {
            this.availableDevices = { screens: ['0'], audio: ['0'] };
            return;
        }

        return new Promise((resolve, reject) => {
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
                
                const devices = this.parseAVFoundationDevices(errorOutput);
                this.availableDevices = devices;
                
                console.log('Detected devices:', devices);
                resolve(devices);
            });

            listProcess.on('error', (error) => {
                console.error('Device detection failed:', error);
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
        // Check if already recording and clean state
        if (this.isRecording) {
            throw new Error('Recording is already in progress');
        }

        // Clear any previous state
        this.forceCleanup();
        this.lastError = null;
        this.recordingValidated = false;

        const {
            screenId = 'default',
            includeMicrophone = true,
            includeSystemAudio = false,
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

            // Set up event handlers before setting state
            this.setupRecordingHandlers();
            
            // NEW: Wait for recording validation before confirming success
            return new Promise((resolve, reject) => {
                // Set up validation timeout
                this.startupTimeout = setTimeout(() => {
                    if (!this.recordingValidated) {
                        const error = this.lastError || 'Recording failed to start - no frames captured within 10 seconds';
                        console.error('❌ Recording startup timeout:', error);
                        this.forceCleanup();
                        reject(new Error(error));
                    }
                }, 10000);

                // Handle early process exit
                const handleEarlyExit = (code) => {
                    if (!this.recordingValidated) {
                        clearTimeout(this.startupTimeout);
                        const error = this.lastError || `FFmpeg exited early with code ${code}`;
                        console.error('❌ Early FFmpeg exit:', error);
                        this.forceCleanup();
                        reject(new Error(error));
                    }
                };

                // Handle startup success
                const handleValidation = () => {
                    clearTimeout(this.startupTimeout);
                    this.recordingProcess.off('close', handleEarlyExit);
                    
                    // NOW set the recording state
                    this.isRecording = true;
                    this.isPaused = false;
                    this.recordingStartTime = Date.now();

                    this.emit('started', { 
                        outputPath: this.outputPath,
                        audioPath: this.audioOutputPath 
                    });

                    resolve({
                        success: true,
                        outputPath: this.outputPath,
                        audioPath: this.audioOutputPath,
                        message: 'Screen recording started successfully'
                    });
                };

                // Monitor for early exit
                this.recordingProcess.once('close', handleEarlyExit);
                
                // Monitor for validation
                this.once('recording-validated', handleValidation);
            });

        } catch (error) {
            this.forceCleanup();
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

        // Only add audio output if we have microphone
        if (audioPath && includeMicrophone) {
            args.push('-map', '0:a', '-c:a', 'pcm_s16le', '-ar', '16000', '-ac', '1', audioPath);
        }

        return args;
    }

    async buildMacOSArgs(options) {
        const { screenId, includeMicrophone, includeSystemAudio } = options;
        let args = [];

        // NEW: Better device selection
        const screenDevice = this.availableDevices?.screens?.[0] || '1';  // Changed from '0' to '1'
        const audioDevice = this.availableDevices?.audio?.[0] || '0';

        args.push('-f', 'avfoundation');
        
        if (includeMicrophone) {
            args.push('-i', `${screenDevice}:${audioDevice}`);
            console.log(`Using screen device ${screenDevice} and audio device ${audioDevice}`);
        } else {
            args.push('-i', `${screenDevice}:none`);
            console.log(`Using screen device ${screenDevice} with no audio`);
        }

        // NEW: More conservative video settings
        args.push('-c:v', 'libx264');
        args.push('-pix_fmt', 'yuv420p');
        args.push('-framerate', '15');  // Reduced from 30 to be more reliable
        args.push('-preset', 'ultrafast');  // Faster encoding
        
        // Let FFmpeg auto-detect resolution
        // Don't specify video_size to avoid resolution conflicts

        return args;
    }

    async buildWindowsArgs(options) {
        const { includeMicrophone, includeSystemAudio } = options;
        let args = [];

        args.push('-f', 'gdigrab');
        args.push('-framerate', '15');  // Reduced for reliability
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
        args.push('-framerate', '15');  // Reduced for reliability
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

        if (audioQuality) {
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
        }

        return settings;
    }

    // NEW: Improved event handler setup with validation
    setupRecordingHandlers() {
        if (!this.recordingProcess) return;

        let frameCount = 0;
        let errorBuffer = '';

        this.recordingProcess.stdout.on('data', (data) => {
            console.log('FFmpeg stdout:', data.toString());
        });

        this.recordingProcess.stderr.on('data', (data) => {
            const output = data.toString();
            errorBuffer += output;
            console.log('FFmpeg stderr:', output);
            
            // NEW: Check for validation (first frame captured)
            if (!this.recordingValidated) {
                if (output.includes('frame=') || output.includes('time=')) {
                    frameCount++;
                    if (frameCount >= 3) {  // Wait for a few frames to confirm
                        console.log('✅ Recording validated - frames are being captured');
                        this.recordingValidated = true;
                        this.emit('recording-validated');
                    }
                }
                
                // Check for specific startup errors
                if (output.includes('Input/output error') || 
                    output.includes('Selected framerate') && output.includes('is not supported') ||
                    output.includes('does not support') ||
                    output.includes('No such file or directory') ||
                    output.includes('Device or resource busy')) {
                    
                    this.lastError = this.extractDetailedError(errorBuffer);
                    console.error('❌ FFmpeg startup error detected:', this.lastError);
                }
            }
            
            this.parseProgress(output);
        });

        this.recordingProcess.on('close', (code) => {
            console.log(`Recording process exited with code ${code}`);
            const wasRecording = this.isRecording;
            
            // Clear monitoring
            if (this.processMonitorInterval) {
                clearInterval(this.processMonitorInterval);
                this.processMonitorInterval = null;
            }
            
            // Always clean state on close
            this.isRecording = false;
            this.isPaused = false;

            if (code === 0 && wasRecording && this.recordingValidated) {
                this.emit('completed', {
                    outputPath: this.outputPath,
                    audioPath: this.audioOutputPath,
                    duration: this.recordingStartTime ? Date.now() - this.recordingStartTime : 0
                });
            } else if (wasRecording || !this.recordingValidated) {
                // Error occurred
                const errorMsg = this.lastError || `Recording process failed with code ${code}`;
                this.emit('error', {
                    error: errorMsg,
                    outputPath: this.outputPath,
                    code: code
                });
            }
            
            this.recordingProcess = null;
        });

        this.recordingProcess.on('error', (error) => {
            console.error('Recording process error:', error);
            this.lastError = error.message;
            this.forceCleanup();
            this.emit('error', { 
                error: error.message,
                type: 'process_error'
            });
        });

        // NEW: Monitor process health
        this.startProcessMonitoring();
    }

    // NEW: Extract more detailed error information
    extractDetailedError(errorOutput) {
        const lines = errorOutput.split('\n');
        
        // Look for specific error patterns
        for (const line of lines) {
            if (line.includes('Input/output error')) {
                return 'Device access error - please check screen recording permissions and try a different screen/audio device';
            }
            if (line.includes('Selected framerate') && line.includes('is not supported')) {
                return 'Framerate not supported by device - try refreshing devices or using a different display';
            }
            if (line.includes('does not support')) {
                return 'Device configuration not supported - try different audio/video settings';
            }
            if (line.includes('No such file or directory')) {
                return 'Device not found - please refresh devices and try again';
            }
            if (line.includes('Device or resource busy')) {
                return 'Device is busy - close other recording apps and try again';
            }
        }
        
        return 'Device configuration error - try refreshing devices or check permissions';
    }

    // NEW: Process health monitoring
    startProcessMonitoring() {
        this.processMonitorInterval = setInterval(() => {
            if (this.recordingProcess && this.isRecording) {
                // Check if process is still alive
                if (this.recordingProcess.killed || this.recordingProcess.exitCode !== null) {
                    console.warn('⚠️ Recording process died unexpectedly');
                    this.forceCleanup();
                    this.emit('error', { 
                        error: 'Recording process died unexpectedly',
                        type: 'process_died'
                    });
                }
            }
        }, 5000);
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

    // FIXED: Better pause/resume with process validation
    pauseRecording() {
        console.log('Pause requested - isRecording:', this.isRecording, 'isPaused:', this.isPaused, 'process exists:', !!this.recordingProcess);
        
        if (!this.isRecording || !this.recordingProcess || !this.recordingValidated) {
            return { success: false, error: 'Not recording or recording not validated' };
        }
        
        if (this.isPaused) {
            return { success: false, error: 'Already paused' };
        }

        // Check if process is still alive
        if (this.recordingProcess.killed || this.recordingProcess.exitCode !== null) {
            this.forceCleanup();
            return { success: false, error: 'Recording process has ended' };
        }

        try {
            if (this.platform !== 'win32') {
                this.recordingProcess.kill('SIGSTOP');
                this.isPaused = true;
                this.emit('paused');
                return { success: true };
            } else {
                return { success: false, error: 'Pause not supported on Windows' };
            }
        } catch (err) {
            console.error('Pause failed:', err);
            return { success: false, error: err.message };
        }
    }

    resumeRecording() {
        console.log('Resume requested - isRecording:', this.isRecording, 'isPaused:', this.isPaused, 'process exists:', !!this.recordingProcess);
        
        if (!this.isRecording || !this.recordingProcess || !this.recordingValidated) {
            return { success: false, error: 'Not recording or recording not validated' };
        }
        
        if (!this.isPaused) {
            return { success: false, error: 'Not paused' };
        }

        // Check if process is still alive
        if (this.recordingProcess.killed || this.recordingProcess.exitCode !== null) {
            this.forceCleanup();
            return { success: false, error: 'Recording process has ended' };
        }

        try {
            if (this.platform !== 'win32') {
                this.recordingProcess.kill('SIGCONT');
                this.isPaused = false;
                this.emit('resumed');
                return { success: true };
            } else {
                return { success: false, error: 'Resume not supported on Windows' };
            }
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
                this.forceCleanup();
                reject(new Error('Recording stop timeout'));
            }, 10000);

            const handleClose = (code) => {
                clearTimeout(timeout);
                const result = {
                    success: true,
                    outputPath: this.outputPath,
                    audioPath: this.audioOutputPath,
                    duration: this.recordingStartTime ? Date.now() - this.recordingStartTime : 0
                };
                this.forceCleanup();
                resolve(result);
            };

            const handleError = (error) => {
                clearTimeout(timeout);
                this.forceCleanup();
                reject(error);
            };

            this.recordingProcess.once('close', handleClose);
            this.recordingProcess.once('error', handleError);

            try {
                if (this.platform === 'win32') {
                    this.recordingProcess.stdin.write('q\n');
                } else {
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

    // IMPROVED: Force cleanup method
    forceCleanup() {
        console.log('🧹 Force cleanup called');
        
        // Clear timeouts
        if (this.startupTimeout) {
            clearTimeout(this.startupTimeout);
            this.startupTimeout = null;
        }
        
        if (this.processMonitorInterval) {
            clearInterval(this.processMonitorInterval);
            this.processMonitorInterval = null;
        }
        
        // Kill process if still running
        if (this.recordingProcess && !this.recordingProcess.killed) {
            try {
                this.recordingProcess.kill('SIGKILL');
            } catch (err) {
                console.warn('Failed to kill recording process:', err);
            }
        }
        
        // Reset state
        this.isRecording = false;
        this.isPaused = false;
        this.recordingProcess = null;
        this.outputPath = null;
        this.audioOutputPath = null;
        this.recordingStartTime = null;
        this.lastError = null;
        this.recordingValidated = false;
    }

    getStatus() {
        return {
            isRecording: this.isRecording,
            isPaused: this.isPaused,
            duration: this.isRecording && this.recordingStartTime ? Date.now() - this.recordingStartTime : 0,
            outputPath: this.outputPath,
            audioPath: this.audioOutputPath,
            recordingsDirectory: this.recordingsDir,
            availableDevices: this.availableDevices,
            lastError: this.lastError,
            hasActiveProcess: !!this.recordingProcess,
            recordingValidated: this.recordingValidated
        };
    }

    cleanup() {
        this.forceCleanup();
    }

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