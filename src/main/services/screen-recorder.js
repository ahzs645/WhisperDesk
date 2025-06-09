// src/main/services/screen-recorder.js - FIXED: Device Selection & Permission Prompting
const { desktopCapturer, systemPreferences, shell } = require('electron');
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
        
        // Process monitoring
        this.processMonitorInterval = null;
        this.recordingValidated = false;
        this.startupTimeout = null;
        this.validationFrameCount = 0;
    }

    async initialize() {
        try {
            await fs.mkdir(this.recordingsDir, { recursive: true });
            
            // 🔴 IMPROVED: Better permission checking and prompting
            await this.checkAndRequestPermissions();
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

    // 🔴 NEW: Comprehensive permission checking with user prompts
    async checkAndRequestPermissions() {
        if (this.platform !== 'darwin') {
            return true; // Only needed on macOS
        }

        console.log('🔐 Checking macOS permissions...');

        try {
            // Check screen recording permission
            const screenStatus = systemPreferences.getMediaAccessStatus('screen');
            console.log('Screen recording permission status:', screenStatus);

            if (screenStatus === 'denied') {
                console.log('❌ Screen recording permission denied');
                
                // Show system preferences
                await this.showPermissionDialog('screen');
                throw new Error('Screen recording permission is denied. Please enable it in System Preferences → Privacy & Security → Screen Recording');
            }

            if (screenStatus === 'not-determined') {
                console.log('⚠️ Screen recording permission not determined, requesting...');
                
                try {
                    await systemPreferences.askForMediaAccess('screen');
                    
                    // Check again after request
                    const newScreenStatus = systemPreferences.getMediaAccessStatus('screen');
                    console.log('Screen permission after request:', newScreenStatus);
                    
                    if (newScreenStatus !== 'granted') {
                        await this.showPermissionDialog('screen');
                        throw new Error('Screen recording permission not granted. Please enable it in System Preferences → Privacy & Security → Screen Recording');
                    }
                } catch (error) {
                    console.error('Failed to request screen permission:', error);
                    await this.showPermissionDialog('screen');
                    throw new Error('Could not request screen recording permission. Please manually enable it in System Preferences → Privacy & Security → Screen Recording');
                }
            }

            // Check microphone permission
            const micStatus = systemPreferences.getMediaAccessStatus('microphone');
            console.log('Microphone permission status:', micStatus);

            if (micStatus === 'not-determined') {
                console.log('⚠️ Microphone permission not determined, requesting...');
                try {
                    await systemPreferences.askForMediaAccess('microphone');
                } catch (error) {
                    console.warn('Failed to request microphone permission:', error);
                    // Don't fail completely for microphone - user can still record without audio
                }
            }

            console.log('✅ Permission check completed');
            return true;

        } catch (error) {
            console.error('❌ Permission check failed:', error);
            throw error;
        }
    }

    // 🔴 NEW: Helper to show system preferences for permissions
    async showPermissionDialog(type) {
        const message = type === 'screen' 
            ? 'WhisperDesk needs screen recording permission to capture your screen.\n\nWould you like to open System Preferences to enable it?'
            : 'WhisperDesk needs microphone permission to capture audio.\n\nWould you like to open System Preferences to enable it?';

        const { dialog } = require('electron');
        
        const response = await dialog.showMessageBox(null, {
            type: 'warning',
            title: 'Permission Required',
            message: message,
            buttons: ['Open System Preferences', 'Cancel'],
            defaultId: 0,
            cancelId: 1
        });

        if (response.response === 0) {
            // Open system preferences to the appropriate section
            if (type === 'screen') {
                await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
            } else {
                await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
            }
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

    // 🔴 FIXED: Better device detection with proper defaults
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
                console.log('🎯 Will use default screen:', devices.screens[0], 'and audio:', devices.audio[0]);
                resolve(devices);
            });

            listProcess.on('error', (error) => {
                console.error('Device detection failed:', error);
                // 🔴 FIXED: Better fallback based on detected devices in logs
                this.availableDevices = { screens: ['2'], audio: ['0'] };  // Use the detected screen '2'
                resolve(this.availableDevices);
            });

            setTimeout(() => {
                listProcess.kill();
                this.availableDevices = { screens: ['2'], audio: ['0'] };  // Use the detected screen '2'
                resolve(this.availableDevices);
            }, 10000);
        });
    }

    // 🔴 IMPROVED: Better device parsing with validation
    parseAVFoundationDevices(output) {
        const devices = { screens: [], audio: [] };
        const deviceNames = { screens: {}, audio: {} };
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
                const deviceName = deviceMatch[2].trim();
                
                if (currentSection === 'video' && deviceName.toLowerCase().includes('screen')) {
                    devices.screens.push(deviceId);
                    deviceNames.screens[deviceId] = deviceName;
                    console.log(`📺 Found screen device: [${deviceId}] ${deviceName}`);
                } else if (currentSection === 'audio') {
                    devices.audio.push(deviceId);
                    deviceNames.audio[deviceId] = deviceName;
                    console.log(`🎵 Found audio device: [${deviceId}] ${deviceName}`);
                }
            }
        }

        // 🔴 FIXED: Use the first detected screen device, not a hardcoded default
        if (devices.screens.length === 0) {
            console.warn('⚠️ No screen devices detected, using fallback');
            devices.screens.push('2');  // Based on your logs, '2' was detected
            deviceNames.screens['2'] = 'Capture screen 0';
        }
        if (devices.audio.length === 0) {
            console.warn('⚠️ No audio devices detected, using fallback');
            devices.audio.push('0');
            deviceNames.audio['0'] = 'Default Audio';
        }

        console.log('🎯 Parsed devices - Screens:', devices.screens, 'Audio:', devices.audio);
        return {
            screens: devices.screens,
            audio: devices.audio,
            deviceNames: deviceNames
        };
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

        // 🔴 IMPROVED: Better permission verification before starting
        if (this.platform === 'darwin') {
            const screenStatus = systemPreferences.getMediaAccessStatus('screen');
            if (screenStatus !== 'granted') {
                await this.showPermissionDialog('screen');
                throw new Error('Screen recording permission required. Please enable it in System Preferences → Privacy & Security → Screen Recording');
            }
        }

        // Clear any previous state
        this.forceCleanup();
        this.lastError = null;
        this.recordingValidated = false;
        this.validationFrameCount = 0;

        // 🔴 FIXED: Use the first available screen device instead of hardcoded default
        const defaultScreenId = this.availableDevices?.screens?.[0] || '2';
        const defaultAudioId = this.availableDevices?.audio?.[0] || '0';

        const {
            screenId = defaultScreenId,  // Use detected default
            includeMicrophone = true,
            includeSystemAudio = false,
            audioQuality = 'medium',
            videoQuality = 'medium',
            audioPath = null
        } = options;

        console.log(`🎯 Using screen device: ${screenId}, audio device: ${defaultAudioId}`);
        console.log(`📱 Available devices:`, this.availableDevices);

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            this.outputPath = path.join(this.recordingsDir, `recording-${timestamp}.mp4`);
            this.audioOutputPath = audioPath || path.join(this.recordingsDir, `audio-${timestamp}.wav`);

            // 🔴 FIXED: Use the detected screen device
            const ffmpegArgs = await this.buildConservativeFFmpegArgs({
                screenId,
                audioInputId: defaultAudioId,  // Use detected audio device
                includeMicrophone,
                includeSystemAudio,
                audioQuality,
                videoQuality,
                outputPath: this.outputPath,
                audioPath: this.audioOutputPath
            });

            console.log('Starting screen recording with FIXED args:', ffmpegArgs);

            this.recordingProcess = spawn(this.ffmpegPath, ffmpegArgs, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // Set up event handlers before setting state
            this.setupRecordingHandlers();
            
            // Wait for recording validation before confirming success
            return new Promise((resolve, reject) => {
                // Set up validation timeout
                this.startupTimeout = setTimeout(() => {
                    if (!this.recordingValidated) {
                        const error = this.lastError || 'Recording failed to start - no frames captured within 15 seconds';
                        console.error('❌ Recording startup timeout:', error);
                        this.forceCleanup();
                        reject(new Error(error));
                    }
                }, 15000);

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

    // 🔴 FIXED: Use properly detected device IDs
    async buildConservativeFFmpegArgs(options) {
        const {
            screenId,
            audioInputId,
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
                args = args.concat(await this.buildConservativeMacOSArgs(options));
                break;
            case 'win32':
                args = args.concat(await this.buildConservativeWindowsArgs(options));
                break;
            default:
                args = args.concat(await this.buildConservativeLinuxArgs(options));
                break;
        }

        // Conservative quality settings
        args = args.concat(this.getConservativeQualitySettings(videoQuality, audioQuality));
        
        // Main video output
        args.push(outputPath);

        // Only add audio output if we have microphone
        if (audioPath && includeMicrophone) {
            args.push('-map', '0:a', '-c:a', 'pcm_s16le', '-ar', '16000', '-ac', '1', audioPath);
        }

        return args;
    }

    // 🔴 FIXED: Use the correct device IDs from detection
    async buildConservativeMacOSArgs(options) {
        const { screenId, audioInputId, includeMicrophone, includeSystemAudio } = options;
        let args = [];

        // 🔴 CRITICAL FIX: Use the provided device IDs directly, don't second-guess them
        console.log(`🎯 Using screen device: ${screenId}, audio device: ${audioInputId}`);

        args.push('-f', 'avfoundation');
        
        if (includeMicrophone && audioInputId) {
            // 🔴 FIXED: Use the correct audio device ID
            args.push('-i', `${screenId}:${audioInputId}`);
            console.log(`Using screen device ${screenId} and audio device ${audioInputId}`);
        } else {
            args.push('-i', `${screenId}:none`);
            console.log(`Using screen device ${screenId} with no audio`);
        }

        // 🔴 FIXED: More conservative video settings to avoid framerate issues
        args.push('-c:v', 'libx264');
        args.push('-preset', 'ultrafast');
        args.push('-crf', '28');
        
        // 🔴 CRITICAL: Use only supported framerates (30 or 60 based on device detection logs)
        args.push('-r', '30');  // Use 30 FPS which was shown as supported
        
        args.push('-pix_fmt', 'yuv420p');
        args.push('-capture_cursor', '1');
        args.push('-capture_mouse_clicks', '0');
        args.push('-t', '3600');  // 1 hour max recording

        return args;
    }

    async buildConservativeWindowsArgs(options) {
        const { includeMicrophone, includeSystemAudio } = options;
        let args = [];

        args.push('-f', 'gdigrab');
        args.push('-framerate', '15');  // Conservative framerate
        args.push('-offset_x', '0');
        args.push('-offset_y', '0');
        // Don't specify video_size - let FFmpeg auto-detect
        args.push('-i', 'desktop');

        if (includeMicrophone) {
            args.push('-f', 'dshow');
            args.push('-i', 'audio="Default Audio Device"');
        }

        return args;
    }

    async buildConservativeLinuxArgs(options) {
        const { includeMicrophone, includeSystemAudio } = options;
        let args = [];

        const display = process.env.DISPLAY || ':0';
        
        args.push('-f', 'x11grab');
        args.push('-framerate', '15');  // Conservative framerate
        // Don't specify video_size - let FFmpeg auto-detect
        args.push('-i', display + '+0,0');

        if (includeMicrophone) {
            args.push('-f', 'pulse');
            args.push('-i', 'default');
        }

        return args;
    }

    // 🔴 FIXED: Much more conservative quality settings
    getConservativeQualitySettings(videoQuality, audioQuality) {
        const settings = [];

        // Always use conservative video settings
        settings.push('-c:v', 'libx264');
        settings.push('-preset', 'ultrafast');
        settings.push('-crf', '28');  // Lower quality but reliable
        settings.push('-pix_fmt', 'yuv420p');  // Force compatible format
        
        // 🔴 NEW: Add buffer and threading settings for stability
        settings.push('-threads', '2');  // Limit threads
        settings.push('-bufsize', '2M');  // Add buffer
        
        if (audioQuality) {
            // Conservative audio settings
            settings.push('-c:a', 'aac');
            settings.push('-b:a', '128k');  // Lower bitrate for compatibility
            settings.push('-ar', '44100');  // Standard sample rate
            settings.push('-ac', '2');  // Stereo
        }

        return settings;
    }

    // 🔴 IMPROVED: Better event handler setup with frame validation
    setupRecordingHandlers() {
        if (!this.recordingProcess) return;

        this.validationFrameCount = 0;
        let errorBuffer = '';

        this.recordingProcess.stdout.on('data', (data) => {
            console.log('FFmpeg stdout:', data.toString());
        });

        this.recordingProcess.stderr.on('data', (data) => {
            const output = data.toString();
            errorBuffer += output;
            console.log('FFmpeg stderr:', output);
            
            // 🔴 IMPROVED: Better validation logic
            if (!this.recordingValidated) {
                // Count actual frame processing
                if (output.includes('frame=')) {
                    const frameMatch = output.match(/frame=\s*(\d+)/);
                    if (frameMatch) {
                        const currentFrames = parseInt(frameMatch[1]);
                        if (currentFrames > 0) {
                            this.validationFrameCount = currentFrames;
                        }
                    }
                }
                
                // Validate after we see some frames being processed
                if (this.validationFrameCount >= 5) {  // Wait for 5 frames
                    console.log('✅ Recording validated - frames are being captured:', this.validationFrameCount);
                    this.recordingValidated = true;
                    this.emit('recording-validated');
                }
                
                // 🔴 IMPROVED: Better error detection
                if (output.includes('Input/output error') || 
                    output.includes('does not support') ||
                    output.includes('No such file or directory') ||
                    output.includes('Device or resource busy') ||
                    output.includes('Pixel format') && output.includes('not supported') ||
                    output.includes('No frames to encode')) {
                    
                    this.lastError = this.extractDetailedError(errorBuffer);
                    console.error('❌ FFmpeg startup error detected:', this.lastError);
                }
                
                // 🔴 NEW: Detect "More than 1000 frames duplicated" as an error
                if (output.includes('More than 1000 frames duplicated')) {
                    this.lastError = 'Device not capturing properly - try selecting a different screen or check permissions';
                    console.error('❌ FFmpeg frame duplication error:', this.lastError);
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

        // Process health monitoring
        this.startProcessMonitoring();
    }

    // 🔴 IMPROVED: Better error extraction with specific suggestions
    extractDetailedError(errorOutput) {
        const lines = errorOutput.split('\n');
        
        // Look for specific error patterns with helpful messages
        for (const line of lines) {
            if (line.includes('Input/output error')) {
                return 'Device access error - please check screen recording permissions in System Preferences → Security & Privacy → Screen Recording';
            }
            if (line.includes('Pixel format') && line.includes('not supported')) {
                return 'Video format not supported - try selecting a different screen or restart the app';
            }
            if (line.includes('does not support')) {
                return 'Device configuration not supported - try selecting a different display';
            }
            if (line.includes('No such file or directory')) {
                return 'Recording device not found - please refresh devices and try again';
            }
            if (line.includes('Device or resource busy')) {
                return 'Recording device is busy - close other screen recording apps and try again';
            }
            if (line.includes('More than 1000 frames duplicated')) {
                return 'Screen capture not working properly - try selecting a different display or check permissions';
            }
            if (line.includes('No frames to encode')) {
                return 'No video frames captured - check that the selected screen is active and visible';
            }
        }
        
        return 'Recording startup failed - try refreshing devices or check permissions';
    }

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
                duration: totalSeconds * 1000,  // Convert to milliseconds
                timestamp: Date.now()
            });
        }
    }

    // Rest of the methods remain the same but with better state management
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
        this.validationFrameCount = 0;
    }

    getStatus() {
        return {
            isRecording: this.isRecording,
            isPaused: this.isPaused,
            duration: this.recordingStartTime ? Date.now() - this.recordingStartTime : 0,
            outputPath: this.outputPath,
            audioPath: this.audioOutputPath,
            recordingsDirectory: this.recordingsDir,
            lastError: this.lastError,
            recordingValidated: this.recordingValidated,
            hasActiveProcess: !!this.recordingProcess,
            availableDevices: this.availableDevices || {
                screens: [],
                audio: [],
                deviceNames: {
                    screens: {},
                    audio: {}
                }
            }
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