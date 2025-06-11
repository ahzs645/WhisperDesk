// src/main/services/providers/native-whisper-provider-dll.js
// UPDATED: Integrated PyAnnote diarization pipeline

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { spawn } = require('child_process');

class NativeWhisperProviderDLL extends EventEmitter {
  constructor(modelManager, binaryManager) {
    super();
    this.modelManager = modelManager;
    this.binaryManager = binaryManager;
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-native');
    this.available = false;
    this.platform = os.platform();
    this.buildType = this.platform === 'win32' ? 'dll-based' : 'static';
    this.executableName = this.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
    
    // 🔴 NEW: Initialize PyAnnote diarization manager
    this.diarizationBinaryManager = null;
    this.diarizationAvailable = false;
    
    this.supportedLanguages = [
      'auto', 'en', 'zh', 'de', 'es', 'ru', 'ko', 'fr', 'ja', 'pt', 'tr', 'pl',
      'ca', 'nl', 'ar', 'sv', 'it', 'id', 'hi', 'fi', 'vi', 'he', 'uk', 'el',
      'ms', 'cs', 'ro', 'da', 'hu', 'ta', 'no', 'th', 'ur', 'hr', 'bg', 'lt',
      'la', 'mi', 'ml', 'cy', 'sk', 'te', 'fa', 'lv', 'bn', 'sr', 'az', 'sl',
      'kn', 'et', 'mk', 'br', 'eu', 'is', 'hy', 'ne', 'mn', 'bs', 'kk', 'sq',
      'sw', 'gl', 'mr', 'pa', 'si', 'km', 'sn', 'yo', 'so', 'af', 'oc', 'ka',
      'be', 'tg', 'sd', 'gu', 'am', 'yi', 'lo', 'uz', 'fo', 'ht', 'ps', 'tk',
      'nn', 'mt', 'sa', 'lb', 'my', 'bo', 'tl', 'mg', 'as', 'tt', 'haw', 'ln',
      'ha', 'ba', 'jw', 'su'
    ];
  }

  async initialize() {
    console.log('🔧 Initializing NativeWhisperProvider with PyAnnote diarization...');
    console.log(`🔧 Platform: ${this.platform}`);
    console.log(`🔧 Build type: ${this.buildType}`);
    console.log(`🔧 Executable: ${this.executableName}`);

    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log(`📁 Temp directory: ${this.tempDir}`);

      // Initialize whisper binary
      this.available = await this.checkAvailability();

      // 🔴 NEW: Initialize PyAnnote diarization
      await this.initializeDiarization();

      if (this.available) {
        console.log('✅ NativeWhisperProvider initialized successfully');
        console.log(`🔧 Using ${this.buildType} build with ${this.executableName}`);
        console.log(`🎭 Diarization available: ${this.diarizationAvailable}`);
      } else {
        console.warn('⚠️ NativeWhisperProvider not available');
      }

    } catch (error) {
      console.error('❌ Failed to initialize NativeWhisperProvider:', error.message);
      this.available = false;
    }
  }

  // 🔴 NEW: Initialize PyAnnote diarization system
  async initializeDiarization() {
    try {
      console.log('🔧 Initializing PyAnnote diarization system...');
      
      // Try to import the diarization binary manager
      const DiarizationBinaryManager = require('../diarization-binary-manager');
      this.diarizationBinaryManager = new DiarizationBinaryManager();
      
      // Check if diarization is available
      const diarizationReady = await this.diarizationBinaryManager.initialize();
      this.diarizationAvailable = diarizationReady;
      
      if (this.diarizationAvailable) {
        console.log('✅ PyAnnote diarization system initialized successfully');
      } else {
        console.warn('⚠️ PyAnnote diarization not available - speaker identification will be disabled');
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to initialize diarization system:', error.message);
      this.diarizationAvailable = false;
    }
  }

  async checkAvailability() {
    try {
      const binaryExists = await this.binaryManager.ensureWhisperBinary();
      if (!binaryExists) {
        console.warn(`❌ Whisper binary (${this.executableName}) not available`);
        return false;
      }

      const installedModels = await this.modelManager.getInstalledModels();
      if (installedModels.length === 0) {
        console.warn('⚠️ No models installed for native provider');
        return false;
      }

      // Test the binary
      const testResult = await this.binaryManager.testBinaryWithResult();
      if (!testResult.success) {
        console.warn(`❌ Binary test failed: ${testResult.error}`);
        return false;
      }

      console.log('✅ Native whisper provider is available');
      console.log(`📊 Binary format: ${testResult.argumentFormat}`);
      console.log(`📊 Binary type: ${testResult.binaryType}`);
      console.log(`📊 Build type: ${testResult.buildType || this.buildType}`);
      return true;

    } catch (error) {
      console.error('❌ Native provider availability check failed:', error.message);
      return false;
    }
  }

  // 🔴 UPDATED: Build whisper args WITHOUT diarization (we'll handle it separately)
  buildWhisperArgs(options) {
    const {
      modelPath,
      filePath,
      language,
      task,
      enableTimestamps,
      temperature,
      bestOf,
      // 🔴 REMOVED: enableSpeakerDiarization - we handle this separately now
      forceTranscription = false
    } = options;

    // Modern whisper-cli.exe arguments
    const args = [
      '--model', modelPath,
      '--file', filePath,
    ];

    // Add progress reporting
    args.push('--print-progress');

    // Language settings
    if (language && language !== 'auto') {
      args.push('--language', language);
    }

    // Task
    if (task === 'translate') {
      args.push('--translate');
    }

    // Output format - VTT with timestamps
    if (enableTimestamps !== false) {
      args.push('--output-vtt');
    }

    // Advanced options
    if (temperature > 0) {
      args.push('--temperature', temperature.toString());
    }

    if (bestOf > 1) {
      args.push('--best-of', bestOf.toString());
    }

    // Audio processing options for better quality
    args.push('--threads', Math.min(4, os.cpus().length).toString());

    // 🔴 IMPORTANT: NO diarization flags for whisper.cpp - we handle it separately
    console.log(`🔧 Built ${this.buildType} whisper-cli args (diarization disabled):`, args.join(' '));
    return args;
  }

  // 🔴 NEW: Perform PyAnnote diarization on audio file
  async performDiarization(audioPath, options = {}) {
    if (!this.diarizationAvailable || !this.diarizationBinaryManager) {
      console.warn('⚠️ Diarization not available, skipping speaker identification');
      return null;
    }

    try {
      console.log('🎭 Starting PyAnnote speaker diarization...');
      
      const diarizationOptions = {
        maxSpeakers: options.maxSpeakers || 10,
        threshold: options.speakerThreshold || 0.5,
        verbose: true
      };

      const result = await this.diarizationBinaryManager.performDiarization(audioPath, diarizationOptions);
      
      if (result && result.segments) {
        console.log(`✅ Diarization completed: ${result.segments.length} segments, ${result.total_speakers || 0} speakers`);
        return result;
      } else {
        console.warn('⚠️ Diarization returned no results');
        return null;
      }
      
    } catch (error) {
      console.error('❌ Diarization failed:', error.message);
      return null;
    }
  }

  // 🔴 NEW: Merge diarization results with transcription
  mergeDiarizationWithTranscription(transcriptionSegments, diarizationResult) {
    if (!diarizationResult || !diarizationResult.segments) {
      console.log('🔄 No diarization data to merge, using original segments');
      return transcriptionSegments;
    }

    console.log('🔄 Merging diarization with transcription...');
    const diarizationSegments = diarizationResult.segments;
    
    // Map each transcription segment to the best matching diarization segment
    const mergedSegments = transcriptionSegments.map((transcriptSegment, index) => {
      const segmentMidTime = (transcriptSegment.start + transcriptSegment.end) / 2;
      
      // Find the diarization segment that contains this time
      const matchingDiarSegment = diarizationSegments.find(diarSegment => 
        segmentMidTime >= diarSegment.start_time && segmentMidTime <= diarSegment.end_time
      );

      if (matchingDiarSegment) {
        return {
          ...transcriptSegment,
          speakerId: `speaker_${matchingDiarSegment.speaker_id}`,
          speakerLabel: `Speaker ${matchingDiarSegment.speaker_id}`,
          speakerConfidence: matchingDiarSegment.confidence || 0.9
        };
      } else {
        // Fallback: find closest diarization segment
        const closest = diarizationSegments.reduce((prev, curr) => {
          const prevDist = Math.abs((prev.start_time + prev.end_time) / 2 - segmentMidTime);
          const currDist = Math.abs((curr.start_time + curr.end_time) / 2 - segmentMidTime);
          return prevDist < currDist ? prev : curr;
        });

        return {
          ...transcriptSegment,
          speakerId: closest ? `speaker_${closest.speaker_id}` : 'speaker_unknown',
          speakerLabel: closest ? `Speaker ${closest.speaker_id}` : 'Unknown Speaker',
          speakerConfidence: closest ? (closest.confidence || 0.7) : 0.5
        };
      }
    });

    console.log(`✅ Merged ${mergedSegments.length} segments with speaker information`);
    return mergedSegments;
  }

  // 🔴 UPDATED: Enhanced process file with optional diarization
  async processFile(filePath, options = {}) {
    if (!this.available) {
      throw new Error('Native whisper provider is not available');
    }

    const transcriptionId = options.transcriptionId || `transcription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const enableDiarization = options.enableSpeakerDiarization && this.diarizationAvailable;

    try {
      // Get binary path
      const binaryPath = this.binaryManager.getWhisperBinaryPath();

      // Get model path
      const modelPath = await this.modelManager.getCompatibleModelPath(
        options.model || 'tiny'
      );

      if (!modelPath) {
        throw new Error(`Model not found: ${options.model || 'tiny'}`);
      }

      console.log(`🔍 Using model: ${modelPath}`);
      console.log(`🔧 Binary type: ${this.buildType}`);
      console.log(`🔧 Executable: ${this.executableName}`);
      console.log(`🎭 Diarization enabled: ${enableDiarization}`);

      // Step 1: Perform diarization if enabled (BEFORE transcription for better results)
      let diarizationResult = null;
      if (enableDiarization) {
        this.emit('progress', { transcriptionId, progress: 5, message: 'Analyzing speakers...' });
        diarizationResult = await this.performDiarization(filePath, options);
      }

      // Step 2: Build arguments for whisper-cli (NO diarization flags)
      const args = this.buildWhisperArgs({
        modelPath,
        filePath,
        language: options.language || 'auto',
        task: options.task,
        enableTimestamps: options.enableTimestamps !== false,
        temperature: options.temperature || 0,
        bestOf: options.bestOf || 1
        // 🔴 NOTE: No diarization options passed to whisper
      });

      // Step 3: Execute whisper-cli for transcription
      this.emit('progress', { transcriptionId, progress: enableDiarization ? 30 : 0 });
      const transcriptionResult = await this.executeWhisper(binaryPath, args, transcriptionId);

      // Step 4: Merge diarization with transcription if available
      if (enableDiarization && diarizationResult) {
        this.emit('progress', { transcriptionId, progress: 95, message: 'Merging speaker information...' });
        
        const mergedSegments = this.mergeDiarizationWithTranscription(
          transcriptionResult.segments || [],
          diarizationResult
        );

        // Generate enhanced speaker statistics
        const speakerStats = this.generateEnhancedSpeakerStatistics(mergedSegments, diarizationResult);

        // Update result with diarization info
        transcriptionResult.segments = mergedSegments;
        transcriptionResult.metadata = {
          ...transcriptionResult.metadata,
          diarizationEnabled: true,
          diarizationMethod: 'pyannote-3.0',
          speakerCount: speakerStats.length,
          speakers: speakerStats,
          totalSpeakers: diarizationResult.total_speakers || speakerStats.length
        };

        console.log(`✅ Enhanced transcription with ${speakerStats.length} speakers completed`);
      }

      // Emit completion
      this.emit('complete', { transcriptionId, result: transcriptionResult });
      console.log(`✅ Transcription completed successfully with ${this.buildType} whisper-cli`);
      return transcriptionResult;

    } catch (error) {
      console.error(`❌ Transcription failed: ${error.message}`);
      this.emit('error', { transcriptionId, error: error.message });
      throw error;
    }
  }

  // 🔴 NEW: Generate enhanced speaker statistics from diarization
  generateEnhancedSpeakerStatistics(segments, diarizationResult) {
    const speakerMap = new Map();

    segments.forEach(segment => {
      const speakerId = segment.speakerId;
      if (!speakerId) return;

      if (!speakerMap.has(speakerId)) {
        speakerMap.set(speakerId, {
          id: speakerId,
          label: segment.speakerLabel,
          totalDuration: 0,
          segmentCount: 0,
          wordCount: 0,
          averageConfidence: 0,
          confidenceSum: 0
        });
      }

      const stats = speakerMap.get(speakerId);
      stats.totalDuration += (segment.end - segment.start);
      stats.segmentCount += 1;
      stats.wordCount += segment.text.split(/\s+/).filter(word => word.length > 0).length;
      stats.confidenceSum += (segment.speakerConfidence || segment.confidence || 0.9);
    });

    // Calculate averages and format stats
    return Array.from(speakerMap.values()).map(stats => ({
      ...stats,
      averageConfidence: stats.segmentCount > 0 ? stats.confidenceSum / stats.segmentCount : 0,
      averageSegmentDuration: stats.segmentCount > 0 ? stats.totalDuration / stats.segmentCount : 0,
      wpm: stats.totalDuration > 0 ? Math.round((stats.wordCount / stats.totalDuration) * 60) : 0,
      // Add percentage of total speaking time
      percentageOfTotal: diarizationResult ? (stats.totalDuration / diarizationResult.total_duration * 100) : 0
    }));
  }

  // 🔴 UPDATED: Enhanced capabilities to indicate diarization support
  getCapabilities() {
    return {
      realtime: false,
      fileTranscription: true,
      speakerDiarization: this.diarizationAvailable, // 🔴 DYNAMIC: Based on PyAnnote availability
      languageDetection: true,
      wordTimestamps: true,
      supportedFormats: ['wav', 'mp3', 'flac', 'm4a', 'ogg', 'opus'],
      supportedLanguages: this.supportedLanguages,
      maxFileSize: '2GB',
      offline: true,
      musicTranscription: true,
      buildType: this.buildType,
      executableName: this.executableName,
      modernCLI: true,
      // 🔴 NEW: Diarization details
      diarizationDetails: this.diarizationAvailable ? {
        method: 'pyannote-3.0',
        maxSpeakers: 20,
        supportsDiarization: true,
        supportsCustomThreshold: true
      } : null
    };
  }

  // 🔴 UPDATED: Provider info with diarization details
  getInfo() {
    return {
      name: `Native Whisper (${this.buildType})`,
      description: `Local whisper.cpp with ${this.buildType} build using ${this.executableName}${this.diarizationAvailable ? ' + PyAnnote diarization' : ''}`,
      available: this.available,
      buildType: this.buildType,
      platform: this.platform,
      executableName: this.executableName,
      binaryPath: this.binaryManager.getWhisperBinaryPath(),
      supportsDiarization: this.diarizationAvailable, // 🔴 KEY: This enables diarization UI
      capabilities: {
        languages: 'auto-detect + 50+ languages',
        maxFileSize: '2GB',
        formats: ['mp3', 'wav', 'mp4', 'avi', 'mov', 'm4a', 'flac'],
        realtime: false,
        offline: true,
        musicTranscription: true,
        modernFormat: true,
        speakerDiarization: this.diarizationAvailable ? 'PyAnnote 3.0' : false
      }
    };
  }

  // Rest of the methods remain the same...
  async executeWhisper(binaryPath, args, transcriptionId) {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Starting whisper-cli transcription: ${transcriptionId}`);
      console.log(`📍 Binary: ${binaryPath}`);
      console.log(`📍 Executable: ${this.executableName}`);
      console.log(`📍 Build type: ${this.buildType}`);
      console.log(`📋 Args: ${args.join(' ')}`);

      const spawnOptions = {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      };

      if (this.platform === 'win32') {
        spawnOptions.cwd = path.dirname(binaryPath);
        console.log(`🔧 Windows: Running from directory: ${spawnOptions.cwd}`);
      }

      const whisperProcess = spawn(binaryPath, args, spawnOptions);

      let stdout = '';
      let stderr = '';
      let progress = 0;

      whisperProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        const progressMatch = output.match(/\[(\d+)%\]/) || 
                             output.match(/progress\s*[:=]\s*(\d+)%/i) ||
                             output.match(/(\d+)% complete/i);
        
        if (progressMatch) {
          const newProgress = parseInt(progressMatch[1]);
          if (newProgress !== progress) {
            progress = newProgress;
            this.emit('progress', { transcriptionId, progress });
            console.log(`📊 Progress: ${newProgress}%`);
          }
        }
      });

      whisperProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log(`📝 whisper-cli stderr: ${output.trim()}`);
        
        const progressMatch = output.match(/progress\s*[:=]\s*(\d+)%/i) ||
                             output.match(/(\d+)% complete/i) ||
                             output.match(/\[(\d+)%\]/);
        
        if (progressMatch) {
          const newProgress = parseInt(progressMatch[1]);
          if (newProgress !== progress) {
            progress = newProgress;
            this.emit('progress', { 
              transcriptionId, 
              progress: newProgress
            });
            console.log(`📊 Progress updated: ${newProgress}%`);
          }
        }
      });

      whisperProcess.on('close', async (code) => {
        console.log(`🏁 whisper-cli process completed with code: ${code}`);
        console.log(`📊 Stdout length: ${stdout.length}, Stderr length: ${stderr.length}`);

        if (code === 0) {
          try {
            const result = await this.parseWhisperCliOutput(transcriptionId, stdout, stderr);
            this.emit('progress', { transcriptionId, progress: 100 });
            resolve(result);
          } catch (parseError) {
            console.error('❌ Failed to parse output:', parseError.message);
            reject(new Error(`Failed to parse transcription output: ${parseError.message}`));
          }
        } else {
          const errorMessage = this.buildErrorMessage(code, stderr);
          console.error(`❌ ${errorMessage}`);
          reject(new Error(errorMessage));
        }
      });

      whisperProcess.on('error', (error) => {
        console.error('❌ Failed to start whisper-cli process:', error.message);
        
        if (this.platform === 'win32' && error.code === 'ENOENT') {
          reject(new Error(`Failed to start whisper-cli.exe. Make sure all DLL files are present in ${path.dirname(binaryPath)}`));
        } else {
          reject(new Error(`Failed to start whisper-cli process: ${error.message}`));
        }
      });

      const timeout = setTimeout(() => {
        console.warn('⏰ whisper-cli process timeout, killing...');
        whisperProcess.kill('SIGTERM');
        reject(new Error('Transcription timeout'));
      }, 10 * 60 * 1000);

      whisperProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  // All other existing methods remain the same...
  async parseWhisperCliOutput(transcriptionId, stdout, stderr) {
    let transcriptionText = '';
    let segments = [];
    let outputSource = 'unknown';

    if (stdout) {
      console.log('📄 Parsing VTT from whisper-cli stdout...');
      const vttResult = this.parseVTTFromStdout(stdout);
      if (vttResult.text) {
        transcriptionText = vttResult.text;
        segments = vttResult.segments || [];
        outputSource = 'stdout_vtt';
        console.log(`✅ VTT parsing successful: ${transcriptionText.length} chars, ${segments.length} segments`);
      }
    }

    if (!transcriptionText) {
      transcriptionText = this.extractPlainTextFromStdout(stdout);
      outputSource = 'stdout_text';
    }

    if (!transcriptionText) {
      throw new Error('No transcription output found - Check whisper-cli binary output');
    }

    const processedSegments = segments.length > 0 ? segments : this.createBasicSegments(transcriptionText);
    const duration = processedSegments.length > 0 
      ? Math.max(...processedSegments.map(s => s.end || 0)) 
      : 0;

    const wordCount = transcriptionText.split(/\s+/).filter(word => word.length > 0).length;
    const avgConfidence = processedSegments.length > 0
      ? processedSegments.reduce((sum, s) => sum + (s.confidence || 0.9), 0) / processedSegments.length
      : 0.9;

    const result = {
      text: transcriptionText.trim(),
      segments: processedSegments,
      
      metadata: {
        duration,
        wordCount,
        segmentCount: processedSegments.length,
        averageConfidence: avgConfidence,
        model: 'whisper-local',
        provider: 'whisper-native',
        language: 'auto',
        createdAt: new Date().toISOString(),
        channels: 1,
        sampleRate: 16000,
        buildType: this.buildType,
        platform: this.platform,
        executableName: this.executableName,
        outputSource,
        diarizationEnabled: false, // Will be updated if diarization was performed
        quality: {
          confidence: avgConfidence,
          wordCount,
          duration,
          wpm: duration > 0 ? Math.round((wordCount / duration) * 60) : 0
        }
      },
      
      provider: 'whisper-native',
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Transcription processed: ${result.text.length} chars, ${result.segments.length} segments`);
    return result;
  }

  createBasicSegments(text) {
    // Create basic segments from text (30-second chunks)
    const words = text.split(/\s+/);
    const segments = [];
    const segmentLength = 30; // 30 seconds per segment
    const wordsPerSegment = Math.ceil(words.length / Math.ceil(words.length / 100)); // ~100 words per segment

    for (let i = 0; i < words.length; i += wordsPerSegment) {
      const segmentWords = words.slice(i, i + wordsPerSegment);
      const segmentIndex = Math.floor(i / wordsPerSegment);
      
      segments.push({
        id: segmentIndex,
        start: segmentIndex * segmentLength,
        end: (segmentIndex + 1) * segmentLength,
        text: segmentWords.join(' '),
        confidence: 0.9,
        words: []
      });
    }

    return segments;
  }

  parseVTTFromStdout(stdout) {
    const lines = stdout.split('\n').filter(line => line.trim());
    const segments = [];
    let fullText = '';
    
    for (const line of lines) {
      const vttMatch = line.match(/\[(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.+)/);
      
      if (vttMatch) {
        const [, startTime, endTime, text] = vttMatch;
        
        const start = this.parseTimeToSeconds(startTime);
        const end = this.parseTimeToSeconds(endTime);
        const segmentText = text.trim();
        
        if (segmentText) {
          segments.push({
            id: segments.length,
            start,
            end,
            text: segmentText,
            confidence: 0.9,
            words: []
          });
          
          fullText += (fullText ? ' ' : '') + segmentText;
        }
      }
    }
    
    return {
      text: fullText,
      segments: segments
    };
  }

  parseTimeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const secondsParts = parts[2].split('.');
    const seconds = parseInt(secondsParts[0]);
    const milliseconds = parseInt(secondsParts[1] || 0);
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  extractPlainTextFromStdout(stdout) {
    const lines = stdout.split('\n').filter(line => 
      line.trim().length > 0 &&
      !line.includes('[') && 
      !line.includes('whisper') && 
      !line.includes('model') &&
      !line.includes('progress') &&
      !line.includes('system_info') &&
      !line.includes('WEBVTT')
    );
    
    return lines.join(' ').trim();
  }

  buildErrorMessage(code, stderr) {
    if (this.platform === 'win32') {
      if (code === 3221225501 || code === -1073741515) {
        return 'DLL loading error - ensure all required DLL files (whisper.dll, ggml.dll, etc.) are present';
      } else if (stderr.includes('SDL2.dll')) {
        return 'SDL2.dll not found or incompatible version';
      }
    }
    
    if (stderr.includes('model') && stderr.includes('not found')) {
      return 'Model file not found or corrupted';
    } else if (stderr.includes('audio') && stderr.includes('format')) {
      return 'Unsupported audio format';
    } else if (stderr.includes('unknown argument') || stderr.includes('unrecognized')) {
      return 'Binary argument error - whisper-cli may be incompatible version';
    } else if (stderr.trim()) {
      return `whisper-cli error: ${stderr.trim()}`;
    } else {
      return `whisper-cli process failed with exit code ${code}`;
    }
  }

  getName() {
    return 'whisper-native';
  }

  getDescription() {
    return `Local whisper.cpp (${this.buildType}) with ${this.executableName}${this.diarizationAvailable ? ' + PyAnnote diarization' : ''}`;
  }

  isAvailable() {
    return this.available;
  }
}

module.exports = NativeWhisperProviderDLL;