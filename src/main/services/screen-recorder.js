// src/main/services/screen-recorder.js
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
    }

    async initialize() {
        try {
            await fs.mkdir(this.recordingsDir, { recursive: true });
            await this.checkPermissions();
            await this.verifyFFmpeg();
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
        // Use bundled ffmpeg-static
        try {
            return require('ffmpeg-static');
        } catch (error) {
            // Fallback to system ffmpeg
            return 'ffmpeg';
        }
    }

    async checkPermissions() {
        if (this.platform === 'darwin') {
            return this.checkMacPermissions();
        }
        return true; // Windows and Linux don't need explicit permission checks here
    }

    async checkMacPermissions() {
        try {
            // Check screen recording permission
            const screenAccess = systemPreferences.getMediaAccessStatus('screen');
            console.log('macOS screen access status:', screenAccess);

            if (screenAccess !== 'granted') {
                // Request permission
                await systemPreferences.askForMediaAccess('screen');
                
                // Check again
                const newStatus = systemPreferences.getMediaAccessStatus('screen');
                if (newStatus !== 'granted') {
                    throw new Error('Screen recording permission not granted. Please grant permission in System Preferences > Security & Privacy > Privacy > Screen Recording');
                }
            }

            // Check microphone permission if needed
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
                    reject(new Error('FFmpeg not available or not working'));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`FFmpeg error: ${error.message}`));
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                process.kill();
                reject(new Error('FFmpeg verification timeout'));
            }, 5000);
        });
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
            includeSystemAudio = true,
            audioQuality = 'medium',
            videoQuality = 'medium',
            audioPath = null
        } = options;

        try {
            await this.checkPermissions();

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            this.outputPath = path.join(this.recordingsDir, `recording-${timestamp}.mp4`);
            this.audioOutputPath = audioPath;

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

            this.setupRecordingHandlers();
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            this.emit('started', { outputPath: this.outputPath });

            return {
                success: true,
                outputPath: this.outputPath,
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
            default: // Linux
                args = args.concat(await this.buildLinuxArgs(options));
                break;
        }

        // Add output quality settings
        args = args.concat(this.getQualitySettings(videoQuality, audioQuality));
        
        // Add output file
        args.push(outputPath);

        if (audioPath) {
            args.push('-vn', '-acodec', 'pcm_s16le', audioPath);
        }

        return args;
    }

    async buildMacOSArgs(options) {
        const { screenId, includeMicrophone, includeSystemAudio } = options;
        let args = [];

        // Screen capture
        args.push('-f', 'avfoundation');
        
        if (includeSystemAudio && includeMicrophone) {
            // Both system audio and microphone
            args.push('-i', '1:0'); // Screen:Microphone
            args.push('-f', 'avfoundation');
            args.push('-i', ':1'); // System audio (requires additional setup)
            args.push('-filter_complex', '[0:a][1:a]amix=inputs=2:duration=longest[audio]');
            args.push('-map', '0:v', '-map', '[audio]');
        } else if (includeMicrophone) {
            // Microphone only
            args.push('-i', '1:0'); // Screen:Microphone
        } else if (includeSystemAudio) {
            // System audio only (requires BlackHole or similar)
            args.push('-i', '1:1'); // Screen:System audio
        } else {
            // Video only
            args.push('-i', '1:none'); // Screen only
        }

        return args;
    }

    async buildWindowsArgs(options) {
        const { includeMicrophone, includeSystemAudio } = options;
        let args = [];

        // Screen capture
        args.push('-f', 'gdigrab');
        args.push('-framerate', '30');
        args.push('-i', 'desktop');

        // Audio capture
        if (includeMicrophone && includeSystemAudio) {
            // Microphone
            args.push('-f', 'dshow');
            args.push('-i', 'audio="Microphone"');
            
            // System audio (What U Hear / Stereo Mix)
            args.push('-f', 'dshow');
            args.push('-i', 'audio="Stereo Mix"');
            
            // Mix audio sources
            args.push('-filter_complex', '[1:a][2:a]amix=inputs=2:duration=longest[audio]');
            args.push('-map', '0:v', '-map', '[audio]');
        } else if (includeMicrophone) {
            args.push('-f', 'dshow');
            args.push('-i', 'audio="Microphone"');
            args.push('-map', '0:v', '-map', '1:a');
        } else if (includeSystemAudio) {
            args.push('-f', 'dshow');
            args.push('-i', 'audio="Stereo Mix"');
            args.push('-map', '0:v', '-map', '1:a');
        }

        return args;
    }

    async buildLinuxArgs(options) {
        const { includeMicrophone, includeSystemAudio } = options;
        let args = [];

        // Get display
        const display = process.env.DISPLAY || ':0';
        
        // Screen capture
        args.push('-f', 'x11grab');
        args.push('-framerate', '30');
        args.push('-i', display);

        // Audio capture
        if (includeMicrophone && includeSystemAudio) {
            // PulseAudio microphone
            args.push('-f', 'pulse');
            args.push('-i', 'default');
            
            // PulseAudio monitor (system audio)
            args.push('-f', 'pulse');
            args.push('-i', 'alsa_output.pci-0000_00_1f.3.analog-stereo.monitor');
            
            // Mix audio sources
            args.push('-filter_complex', '[1:a][2:a]amix=inputs=2:duration=longest[audio]');
            args.push('-map', '0:v', '-map', '[audio]');
        } else if (includeMicrophone) {
            args.push('-f', 'pulse');
            args.push('-i', 'default');
            args.push('-map', '0:v', '-map', '1:a');
        } else if (includeSystemAudio) {
            args.push('-f', 'pulse');
            args.push('-i', 'alsa_output.pci-0000_00_1f.3.analog-stereo.monitor');
            args.push('-map', '0:v', '-map', '1:a');
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

    setupRecordingHandlers() {
        this.recordingProcess.stdout.on('data', (data) => {
            // Process can emit progress data
            console.log('FFmpeg stdout:', data.toString());
        });

        this.recordingProcess.stderr.on('data', (data) => {
            const output = data.toString();
            console.log('FFmpeg stderr:', output);
            
            // Parse for progress information
            this.parseProgress(output);
        });

        this.recordingProcess.on('close', (code) => {
            console.log(`Recording process exited with code ${code}`);
            this.isRecording = false;

            if (code === 0) {
                this.emit('completed', {
                    outputPath: this.outputPath,
                    duration: Date.now() - this.recordingStartTime
                });
            } else {
                this.emit('error', {
                    error: `Recording process failed with code ${code}`,
                    outputPath: this.outputPath
                });
            }
        });

        this.recordingProcess.on('error', (error) => {
            console.error('Recording process error:', error);
            this.emit('error', { error: error.message });
            this.cleanup();
        });
    }

    parseProgress(output) {
        // Parse FFmpeg progress output
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

    pauseRecording() {
        if (!this.isRecording || !this.recordingProcess || this.isPaused) {
            return { success: false, error: 'Not recording or already paused' };
        }

        try {
            this.recordingProcess.stdin.write('p');
            this.isPaused = true;
            this.emit('paused');
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    resumeRecording() {
        if (!this.isRecording || !this.recordingProcess || !this.isPaused) {
            return { success: false, error: 'Not paused' };
        }

        try {
            this.recordingProcess.stdin.write('p');
            this.isPaused = false;
            this.emit('resumed');
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async stopRecording() {
        if (!this.isRecording || !this.recordingProcess) {
            throw new Error('No recording in progress');
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.recordingProcess.kill('SIGKILL');
                reject(new Error('Recording stop timeout'));
            }, 10000);

            this.recordingProcess.once('close', (code) => {
                clearTimeout(timeout);
                this.extractAudio()
                    .then(() => {
                        resolve({
                            success: true,
                            outputPath: this.outputPath,
                            audioPath: this.audioOutputPath,
                            duration: Date.now() - this.recordingStartTime
                        });
                    })
                    .catch((err) => {
                        resolve({
                            success: true,
                            outputPath: this.outputPath,
                            audioPath: this.audioOutputPath,
                            error: err.message,
                            duration: Date.now() - this.recordingStartTime
                        });
                    });
                this.cleanup();
            });

            this.recordingProcess.once('error', (error) => {
                clearTimeout(timeout);
                this.cleanup();
                reject(error);
            });

            // Send graceful termination signal
            if (this.platform === 'win32') {
                this.recordingProcess.stdin.write('q');
            } else {
                this.recordingProcess.kill('SIGTERM');
            }
        });
    }

    async extractAudio() {
        if (!this.audioOutputPath) return Promise.resolve();

        return new Promise((resolve, reject) => {
            const args = ['-i', this.outputPath, '-vn', '-acodec', 'pcm_s16le', '-y', this.audioOutputPath];
            const proc = spawn(this.ffmpegPath, args);

            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error('Audio extraction failed'));
            });
            proc.on('error', reject);
        });
    }

    getStatus() {
        return {
            isRecording: this.isRecording,
            duration: this.isRecording ? Date.now() - this.recordingStartTime : 0,
            outputPath: this.outputPath,
            recordingsDirectory: this.recordingsDir
        };
    }

    async getRecordings() {
        try {
            const files = await fs.readdir(this.recordingsDir);
            const recordings = [];

            for (const file of files) {
                if (file.endsWith('.mp4')) {
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

    cleanup() {
        this.isRecording = false;
        this.recordingProcess = null;
        this.outputPath = null;
        this.audioOutputPath = null;
        this.isPaused = false;
        this.recordingStartTime = null;
    }

    async getSystemAudioDevices() {
        // This is platform-specific and complex
        // For now, return basic info
        switch (this.platform) {
            case 'darwin':
                return [
                    { id: 'blackhole', name: 'BlackHole 2ch', available: false },
                    { id: 'system', name: 'System Audio', available: true }
                ];
            case 'win32':
                return [
                    { id: 'stereo-mix', name: 'Stereo Mix', available: true },
                    { id: 'what-u-hear', name: 'What U Hear', available: false }
                ];
            default:
                return [
                    { id: 'pulse-monitor', name: 'PulseAudio Monitor', available: true }
                ];
        }
    }

    async installSystemAudioSupport() {
        // Provide instructions for setting up system audio capture
        switch (this.platform) {
            case 'darwin':
                return {
                    required: 'BlackHole',
                    instructions: [
                        'Install BlackHole from https://existential.audio/blackhole/',
                        'Configure Audio MIDI Setup to create Multi-Output Device',
                        'Set Multi-Output Device as default output'
                    ]
                };
            case 'win32':
                return {
                    required: 'Stereo Mix',
                    instructions: [
                        'Right-click on sound icon in system tray',
                        'Select "Open Sound settings"',
                        'Click "Sound Control Panel"',
                        'Go to Recording tab',
                        'Right-click and "Show Disabled Devices"',
                        'Enable "Stereo Mix" if available'
                    ]
                };
            default:
                return {
                    required: 'PulseAudio',
                    instructions: [
                        'PulseAudio monitor should work by default',
                        'If not working, try: pactl load-module module-loopback',
                        'Or install pavucontrol for advanced audio control'
                    ]
                };
        }
    }
}

module.exports = EnhancedScreenRecorder;