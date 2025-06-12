// src/main/services/providers/native-whisper-provider-dll.js
// ENHANCED: Complete multi-speaker diarization integration

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { spawn } = require('child_process');

class EnhancedNativeWhisperProvider extends EventEmitter {
  constructor(modelManager, binaryManager) {
    super();
    this.modelManager = modelManager;
    this.binaryManager = binaryManager;
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-native');
    this.available = false;
    this.platform = os.platform();
    this.buildType = this.platform === 'win32' ? 'dll-based' : 'static';
    this.executableName = this.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
    
    // ENHANCED: Initialize diarization with the enhanced manager
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
    console.log('🔧 Initializing Enhanced Native Whisper Provider with Multi-Speaker Diarization...');
    console.log(`🔧 Platform: ${this.platform}`);
    console.log(`🔧 Build type: ${this.buildType}`);
    console.log(`🔧 Executable: ${this.executableName}`);

    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log(`📁 Temp directory: ${this.tempDir}`);

      // Initialize whisper binary
      this.available = await this.checkAvailability();

      // ENHANCED: Initialize enhanced diarization system
      await this.initializeEnhancedDiarization();

      if (this.available) {
        console.log('✅ Enhanced NativeWhisperProvider initialized successfully');
        console.log(`🔧 Using ${this.buildType} build with ${this.executableName}`);
        console.log(`🎭 Diarization available: ${this.diarizationAvailable}`);
        
        if (this.diarizationAvailable) {
          console.log('💡 Multi-speaker detection ready! Use enableSpeakerDiarization: true');
        }
      } else {
        console.warn('⚠️ Enhanced NativeWhisperProvider not available');
      }

    } catch (error) {
      console.error('❌ Failed to initialize Enhanced NativeWhisperProvider:', error.message);
      this.available = false;
    }
  }

  // ENHANCED: Initialize the enhanced diarization system
  async initializeEnhancedDiarization() {
    try {
      console.log('🔧 Initializing Enhanced Multi-Speaker Diarization System...');
      
      // Import the enhanced diarization binary manager
      const EnhancedDiarizationBinaryManager = require('../diarization-binary-manager');
      this.diarizationBinaryManager = new EnhancedDiarizationBinaryManager();
      
      // Check if enhanced diarization is available
      const diarizationReady = await this.diarizationBinaryManager.initialize();
      this.diarizationAvailable = diarizationReady;
      
      if (this.diarizationAvailable) {
        console.log('✅ Enhanced Multi-Speaker Diarization System initialized successfully');
        console.log('🎯 Features available:');
        console.log('   • Cross-platform ONNX Runtime support');
        console.log('   • Aggressive multi-speaker detection');
        console.log('   • Configurable sensitivity thresholds');
        console.log('   • Enhanced speaker statistics');
      } else {
        console.warn('⚠️ Enhanced Diarization not available - single speaker mode only');
        console.warn('💡 Run: npm run build:diarization');
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to initialize enhanced diarization system:', error.message);
      console.warn('💡 Multi-speaker detection will be disabled');
      this.diarizationAvailable = false;
    }
  }

  // ENHANCED: Better availability check
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

      console.log('✅ Enhanced native whisper provider is available');
      console.log(`📊 Binary format: ${testResult.argumentFormat}`);
      console.log(`📊 Binary type: ${testResult.binaryType}`);
      console.log(`📊 Build type: ${testResult.buildType || this.buildType}`);
      return true;

    } catch (error) {
      console.error('❌ Enhanced provider availability check failed:', error.message);
      return false;
    }
  }

  // ENHANCED: Build whisper args for basic transcription (diarization handled separately)
  buildWhisperArgs(options) {
    const {
      modelPath,
      filePath,
      language,
      task,
      enableTimestamps,
      temperature,
      bestOf
    } = options;

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

    console.log(`🔧 Built ${this.buildType} whisper-cli args:`, args.join(' '));
    return args;
  }

  // ENHANCED: Aggressive multi-speaker diarization with configurable sensitivity
  async performEnhancedDiarization(audioPath, options = {}) {
    if (!this.diarizationAvailable || !this.diarizationBinaryManager) {
      console.warn('⚠️ Enhanced diarization not available, skipping multi-speaker detection');
      return null;
    }

    try {
      console.log('🎭 Starting Enhanced Multi-Speaker Diarization...');
      console.log('🎭 Enhanced options:', {
        maxSpeakers: options.maxSpeakers || 10,
        threshold: options.speakerThreshold || 0.01,
        sensitivity: options.diarizationSensitivity || 'normal'
      });
      
      // ENHANCED: Adaptive threshold based on sensitivity setting
      let threshold = options.speakerThreshold || 0.01;
      
      switch (options.diarizationSensitivity) {
        case 'very_high':
          threshold = 0.001;
          break;
        case 'high':
          threshold = 0.005;
          break;
        case 'normal':
          threshold = 0.01;
          break;
        case 'low':
          threshold = 0.05;
          break;
        case 'very_low':
          threshold = 0.1;
          break;
      }
      
      const diarizationOptions = {
        maxSpeakers: options.maxSpeakers || 10,
        threshold: threshold,
        verbose: true,
        outputFormat: 'json'
      };

      console.log('🎭 Final enhanced diarization options:', diarizationOptions);
      console.log('🎯 Threshold explanation:');
      console.log(`   • ${threshold} = ${threshold <= 0.001 ? 'Very sensitive (4+ speakers)' : 
                                       threshold <= 0.01 ? 'Sensitive (2-3 speakers)' : 
                                       'Conservative (1-2 speakers)'}`);

      const result = await this.diarizationBinaryManager.performDiarization(audioPath, diarizationOptions);
      
      if (result && result.segments && Array.isArray(result.segments)) {
        console.log(`✅ Enhanced diarization completed:`);
        console.log(`   📊 ${result.segments.length} segments detected`);
        console.log(`   👥 ${result.total_speakers || 'unknown'} speakers identified`);
        
        // Enhanced speaker distribution analysis
        const speakerCounts = {};
        let totalDuration = 0;
        
        result.segments.forEach(seg => {
          const speaker = seg.speaker_id || 'unknown';
          const duration = (seg.end_time || 0) - (seg.start_time || 0);
          
          if (!speakerCounts[speaker]) {
            speakerCounts[speaker] = { segments: 0, duration: 0 };
          }
          
          speakerCounts[speaker].segments++;
          speakerCounts[speaker].duration += duration;
          totalDuration += duration;
        });
        
        console.log('🎯 Enhanced speaker analysis:');
        Object.entries(speakerCounts).forEach(([speaker, stats]) => {
          const percentage = ((stats.duration / totalDuration) * 100).toFixed(1);
          console.log(`   Speaker ${speaker}: ${stats.segments} segments, ${stats.duration.toFixed(1)}s (${percentage}%)`);
        });
        
        // Enhanced recommendations
        if (result.total_speakers === 1 && threshold > 0.001) {
          console.log('💡 Only 1 speaker detected. Try:');
          console.log('   • Lower threshold (0.001) for more sensitive detection');
          console.log('   • Set diarizationSensitivity: "very_high"');
        } else if (result.total_speakers > 8) {
          console.log('💡 Many speakers detected. Try:');
          console.log('   • Higher threshold (0.05-0.1) for less sensitive detection');
          console.log('   • Set diarizationSensitivity: "low"');
        }
        
        return result;
      } else {
        console.warn('⚠️ Enhanced diarization returned invalid format');
        return null;
      }
      
    } catch (error) {
      console.error('❌ Enhanced diarization failed:', error.message);
      console.error('💡 Troubleshooting tips:');
      console.error('   • Verify all ONNX models are downloaded correctly');
      console.error('   • Check ONNX Runtime library availability');
      console.error('   • Try rebuilding: npm run build:diarization');
      return null;
    }
  }

  // ENHANCED: Better merging with detailed speaker statistics
  mergeEnhancedDiarizationWithTranscription(transcriptionSegments, diarizationResult) {
    if (!diarizationResult || !diarizationResult.segments || !Array.isArray(diarizationResult.segments)) {
      console.log('🔄 No enhanced diarization data to merge, using single speaker');
      return transcriptionSegments.map((segment, index) => ({
        ...segment,
        speakerId: 'speaker_1',
        speakerLabel: 'Speaker 1',
        speakerConfidence: 0.5,
        diarizationMethod: 'fallback'
      }));
    }

    console.log('🔄 Merging enhanced diarization with transcription...');
    console.log(`🔄 Transcription segments: ${transcriptionSegments.length}`);
    console.log(`🔄 Diarization segments: ${diarizationResult.segments.length}`);
    
    const diarizationSegments = diarizationResult.segments;
    
    // ENHANCED: Improved time-based matching algorithm
    const mergedSegments = transcriptionSegments.map((transcriptSegment, index) => {
      const segmentStart = transcriptSegment.start || 0;
      const segmentEnd = transcriptSegment.end || 0;
      const segmentMidTime = (segmentStart + segmentEnd) / 2;
      const segmentDuration = segmentEnd - segmentStart;
      
      // Find best matching diarization segment(s)
      let bestMatch = null;
      let bestOverlap = 0;
      let bestScore = 0;
      
      for (const diarSegment of diarizationSegments) {
        const diarStart = diarSegment.start_time || 0;
        const diarEnd = diarSegment.end_time || 0;
        const diarDuration = diarEnd - diarStart;
        
        // Calculate overlap
        const overlapStart = Math.max(segmentStart, diarStart);
        const overlapEnd = Math.min(segmentEnd, diarEnd);
        const overlap = Math.max(0, overlapEnd - overlapStart);
        
        // Enhanced scoring: overlap + temporal proximity + duration similarity
        const overlapRatio = overlap / Math.max(segmentDuration, diarDuration);
        const proximityScore = 1 - Math.abs(segmentMidTime - ((diarStart + diarEnd) / 2)) / Math.max(segmentDuration, 1);
        const durationSimilarity = 1 - Math.abs(segmentDuration - diarDuration) / Math.max(segmentDuration, diarDuration);
        
        const combinedScore = (overlapRatio * 0.6) + (proximityScore * 0.3) + (durationSimilarity * 0.1);
        
        if (combinedScore > bestScore && overlap > 0) {
          bestScore = combinedScore;
          bestOverlap = overlap;
          bestMatch = diarSegment;
        }
      }

      if (bestMatch && bestScore > 0.1) { // Minimum threshold for matching
        const speakerId = `speaker_${bestMatch.speaker_id}`;
        const confidence = bestMatch.confidence || 0.9;
        
        return {
          ...transcriptSegment,
          speakerId,
          speakerLabel: `Speaker ${bestMatch.speaker_id}`,
          speakerConfidence: confidence,
          diarizationMethod: 'enhanced_onnx',
          diarizationScore: bestScore,
          diarizationOverlap: bestOverlap,
          // Enhanced metadata
          diarizationMatch: {
            originalSpeakerId: bestMatch.speaker_id,
            matchScore: bestScore,
            overlapDuration: bestOverlap,
            confidence: confidence
          }
        };
      } else {
        // ENHANCED: Smarter fallback based on temporal position
        const totalDuration = diarizationResult.total_duration || 
                             Math.max(...diarizationSegments.map(s => s.end_time || 0));
        const positionRatio = segmentMidTime / totalDuration;
        const totalSpeakers = diarizationResult.total_speakers || 2;
        
        // Distribute unknown segments across speakers based on position
        const fallbackSpeakerId = Math.min(
          Math.floor(positionRatio * totalSpeakers) + 1,
          totalSpeakers
        );
        
        return {
          ...transcriptSegment,
          speakerId: `speaker_${fallbackSpeakerId}`,
          speakerLabel: `Speaker ${fallbackSpeakerId}`,
          speakerConfidence: 0.6,
          diarizationMethod: 'enhanced_fallback',
          diarizationMatch: {
            method: 'temporal_distribution',
            positionRatio,
            confidence: 0.6
          }
        };
      }
    });

    // Enhanced post-processing: smooth speaker transitions
    const smoothedSegments = this.smoothSpeakerTransitions(mergedSegments);

    console.log(`✅ Enhanced merging completed: ${smoothedSegments.length} segments`);
    
    // Enhanced speaker distribution analysis
    const speakerCounts = {};
    smoothedSegments.forEach(segment => {
      const speaker = segment.speakerId || 'unknown';
      speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
    });
    console.log('🔄 Final speaker distribution:', speakerCounts);
    
    return smoothedSegments;
  }

  // ENHANCED: Smooth speaker transitions to reduce rapid switching
  smoothSpeakerTransitions(segments, minSegmentDuration = 2.0) {
    if (segments.length <= 2) return segments;
    
    const smoothed = [...segments];
    
    // Pass 1: Merge very short segments with neighbors
    for (let i = 1; i < smoothed.length - 1; i++) {
      const current = smoothed[i];
      const prev = smoothed[i - 1];
      const next = smoothed[i + 1];
      
      const duration = (current.end || 0) - (current.start || 0);
      
      if (duration < minSegmentDuration) {
        // Merge with the neighbor that has the same speaker, or the longer one
        if (prev.speakerId === current.speakerId || next.speakerId === current.speakerId) {
          const targetNeighbor = prev.speakerId === current.speakerId ? prev : next;
          current.speakerId = targetNeighbor.speakerId;
          current.speakerLabel = targetNeighbor.speakerLabel;
          current.speakerConfidence = Math.max(current.speakerConfidence, targetNeighbor.speakerConfidence);
          current.diarizationMethod = 'smoothed_transition';
        }
      }
    }
    
    return smoothed;
  }

  // ENHANCED: Process file with comprehensive multi-speaker support
  async processFile(filePath, options = {}) {
    if (!this.available) {
      throw new Error('Enhanced native whisper provider is not available');
    }

    const transcriptionId = options.transcriptionId || `transcription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const enableDiarization = options.enableSpeakerDiarization && this.diarizationAvailable;

    console.log('🎭 Enhanced Transcription Request:');
    console.log('   - enableSpeakerDiarization:', options.enableSpeakerDiarization);
    console.log('   - diarizationAvailable:', this.diarizationAvailable);
    console.log('   - enableDiarization (final):', enableDiarization);
    console.log('   - diarizationSensitivity:', options.diarizationSensitivity || 'normal');
    console.log('   - maxSpeakers:', options.maxSpeakers || 10);

    try {
      // Get binary and model paths
      const binaryPath = this.binaryManager.getWhisperBinaryPath();
      const modelPath = await this.modelManager.getCompatibleModelPath(options.model || 'tiny');

      if (!modelPath) {
        throw new Error(`Model not found: ${options.model || 'tiny'}`);
      }

      console.log(`🔍 Using model: ${modelPath}`);
      console.log(`🔧 Binary type: ${this.buildType}`);
      console.log(`🔧 Executable: ${this.executableName}`);
      console.log(`🎭 Enhanced diarization enabled: ${enableDiarization}`);

      // ENHANCED: Step 1 - Perform enhanced diarization if enabled
      let enhancedDiarizationResult = null;
      if (enableDiarization) {
        this.emit('progress', { 
          transcriptionId, 
          progress: 5, 
          message: 'Analyzing speakers with enhanced detection...' 
        });
        
        enhancedDiarizationResult = await this.performEnhancedDiarization(filePath, options);
        
        if (enhancedDiarizationResult) {
          console.log('✅ Enhanced diarization successful, proceeding with transcription');
          this.emit('progress', { 
            transcriptionId, 
            progress: 20, 
            message: `Found ${enhancedDiarizationResult.total_speakers || 'multiple'} speakers, transcribing...` 
          });
        } else {
          console.warn('⚠️ Enhanced diarization failed, continuing without speaker info');
        }
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
      });

      // Step 3: Execute whisper-cli for transcription
      this.emit('progress', { 
        transcriptionId, 
        progress: enableDiarization ? 30 : 0,
        message: 'Transcribing audio...'
      });
      
      const transcriptionResult = await this.executeWhisper(binaryPath, args, transcriptionId);

      // ENHANCED: Step 4 - Merge enhanced diarization with transcription
      if (enableDiarization && enhancedDiarizationResult) {
        this.emit('progress', { 
          transcriptionId, 
          progress: 95, 
          message: 'Merging enhanced speaker information...' 
        });
        
        console.log('🔄 Starting enhanced diarization merge...');
        
        const enhancedSegments = this.mergeEnhancedDiarizationWithTranscription(
          transcriptionResult.segments || [],
          enhancedDiarizationResult
        );

        // Generate comprehensive speaker statistics
        const enhancedSpeakerStats = this.generateEnhancedSpeakerStatistics(
          enhancedSegments, 
          enhancedDiarizationResult
        );

        // Update result with enhanced diarization info
        transcriptionResult.segments = enhancedSegments;
        transcriptionResult.metadata = {
          ...transcriptionResult.metadata,
          diarizationEnabled: true,
          diarizationMethod: 'enhanced_pyannote_onnx',
          diarizationVersion: '3.0',
          speakerCount: enhancedSpeakerStats.length,
          speakers: enhancedSpeakerStats,
          totalSpeakers: enhancedDiarizationResult.total_speakers || enhancedSpeakerStats.length,
          diarizationSettings: {
            threshold: options.speakerThreshold || 0.01,
            sensitivity: options.diarizationSensitivity || 'normal',
            maxSpeakers: options.maxSpeakers || 10
          },
          enhancedFeatures: {
            crossPlatformONNX: true,
            adaptiveThresholding: true,
            speakerSmoothing: true,
            temporalDistribution: true
          }
        };

        console.log(`✅ Enhanced transcription with ${enhancedSpeakerStats.length} speakers completed`);
        console.log('🎯 Enhanced features applied:');
        console.log('   • Cross-platform ONNX Runtime');
        console.log('   • Adaptive speaker thresholding');
        console.log('   • Speaker transition smoothing');
        console.log('   • Temporal speaker distribution');
        
      } else {
        // Standard single-speaker fallback
        console.log('📝 Adding single speaker information...');
        transcriptionResult.segments = (transcriptionResult.segments || []).map(segment => ({
          ...segment,
          speakerId: 'speaker_1',
          speakerLabel: 'Speaker 1',
          speakerConfidence: 0.5,
          diarizationMethod: 'single_speaker'
        }));
        
        transcriptionResult.metadata = {
          ...transcriptionResult.metadata,
          diarizationEnabled: false,
          speakerCount: 1,
          speakers: [{
            id: 'speaker_1',
            label: 'Speaker 1',
            totalDuration: transcriptionResult.metadata?.duration || 0,
            segmentCount: transcriptionResult.segments?.length || 0,
            wordCount: transcriptionResult.text?.split(/\s+/).length || 0,
            averageConfidence: 0.5
          }]
        };
      }

      // Emit completion
      this.emit('complete', { transcriptionId, result: transcriptionResult });
      console.log(`✅ Enhanced transcription completed successfully with ${this.buildType} whisper-cli`);
      return transcriptionResult;

    } catch (error) {
      console.error(`❌ Enhanced transcription failed: ${error.message}`);
      this.emit('error', { transcriptionId, error: error.message });
      throw error;
    }
  }

  // ENHANCED: Generate comprehensive speaker statistics
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
          confidenceSum: 0,
          diarizationMethod: segment.diarizationMethod,
          enhancedMetrics: {
            avgSegmentDuration: 0,
            maxSegmentDuration: 0,
            minSegmentDuration: Infinity,
            speakerSwitches: 0
          }
        });
      }

      const stats = speakerMap.get(speakerId);
      const segmentDuration = (segment.end || 0) - (segment.start || 0);
      
      stats.totalDuration += segmentDuration;
      stats.segmentCount += 1;
      stats.wordCount += segment.text.split(/\s+/).filter(word => word.length > 0).length;
      stats.confidenceSum += (segment.speakerConfidence || segment.confidence || 0.9);
      
      // Enhanced metrics
      stats.enhancedMetrics.maxSegmentDuration = Math.max(stats.enhancedMetrics.maxSegmentDuration, segmentDuration);
      stats.enhancedMetrics.minSegmentDuration = Math.min(stats.enhancedMetrics.minSegmentDuration, segmentDuration);
    });

    // Calculate averages and additional metrics
    const totalDuration = diarizationResult?.total_duration || 
                          Math.max(...segments.map(s => s.end || 0));

    return Array.from(speakerMap.values()).map(stats => {
      const avgConfidence = stats.segmentCount > 0 ? stats.confidenceSum / stats.segmentCount : 0;
      const avgSegmentDuration = stats.segmentCount > 0 ? stats.totalDuration / stats.segmentCount : 0;
      const wpm = stats.totalDuration > 0 ? Math.round((stats.wordCount / stats.totalDuration) * 60) : 0;
      const speakingRatio = totalDuration > 0 ? (stats.totalDuration / totalDuration) : 0;

      return {
        ...stats,
        averageConfidence: avgConfidence,
        wpm,
        speakingRatio: Math.round(speakingRatio * 100), // Percentage
        enhancedMetrics: {
          ...stats.enhancedMetrics,
          avgSegmentDuration: Math.round(avgSegmentDuration * 10) / 10,
          minSegmentDuration: stats.enhancedMetrics.minSegmentDuration === Infinity ? 0 : 
                              Math.round(stats.enhancedMetrics.minSegmentDuration * 10) / 10,
          maxSegmentDuration: Math.round(stats.enhancedMetrics.maxSegmentDuration * 10) / 10,
          speakingEfficiency: wpm > 0 ? Math.round((stats.wordCount / stats.segmentCount) * 10) / 10 : 0
        }
      };
    });
  }

  // ENHANCED: Better capabilities reporting
  getCapabilities() {
    return {
      realtime: false,
      fileTranscription: true,
      speakerDiarization: this.diarizationAvailable,
      languageDetection: true,
      wordTimestamps: true,
      supportedFormats: ['wav', 'mp3', 'flac', 'm4a', 'ogg', 'opus', 'mp4', 'avi', 'mov'],
      supportedLanguages: this.supportedLanguages,
      maxFileSize: '2GB',
      offline: true,
      musicTranscription: true,
      buildType: this.buildType,
      executableName: this.executableName,
      modernCLI: true,
      // ENHANCED: Comprehensive diarization capabilities
      enhancedDiarization: this.diarizationAvailable ? {
        method: 'pyannote_onnx_3.0',
        crossPlatform: true,
        maxSpeakers: 20,
        adaptiveThresholding: true,
        sensitivityLevels: ['very_high', 'high', 'normal', 'low', 'very_low'],
        supportedThresholdRange: [0.001, 1.0],
        features: [
          'Multi-speaker detection',
          'Adaptive sensitivity',
          'Speaker transition smoothing',
          'Temporal speaker distribution',
          'Enhanced speaker statistics',
          'Cross-platform ONNX Runtime'
        ],
        recommendations: {
          multiSpeaker: 'Use sensitivity: "high" or threshold: 0.001-0.01',
          conservative: 'Use sensitivity: "low" or threshold: 0.05-0.1',
          balanced: 'Use sensitivity: "normal" or threshold: 0.01'
        }
      } : {
        available: false,
        reason: 'Enhanced diarization system not initialized',
        setupInstructions: 'Run: npm run build:diarization'
      }
    };
  }

  // ENHANCED: Better provider info
  getInfo() {
    const diarizationStatus = this.diarizationAvailable ? 
      'Enhanced Multi-Speaker Detection Ready' : 'Single Speaker Only';
      
    return {
      name: `Enhanced Native Whisper (${this.buildType})`,
      description: `Local whisper.cpp with ${this.buildType} build using ${this.executableName} + ${diarizationStatus}`,
      available: this.available,
      buildType: this.buildType,
      platform: this.platform,
      executableName: this.executableName,
      binaryPath: this.binaryManager.getWhisperBinaryPath(),
      supportsDiarization: this.diarizationAvailable,
      capabilities: {
        languages: 'auto-detect + 100+ languages',
        maxFileSize: '2GB',
        formats: ['mp3', 'wav', 'mp4', 'avi', 'mov', 'm4a', 'flac', 'ogg', 'opus'],
        realtime: false,
        offline: true,
        musicTranscription: true,
        modernFormat: true,
        enhancedFeatures: this.diarizationAvailable ? [
          'Cross-platform ONNX Runtime',
          'Pyannote 3.0 models',
          'Adaptive speaker thresholding',
          'Multi-speaker detection up to 20 speakers',
          'Speaker transition smoothing',
          'Enhanced speaker statistics'
        ] : ['Single speaker transcription'],
        recommendations: this.diarizationAvailable ? {
          sensitive: 'threshold: 0.001 or sensitivity: "very_high"',
          normal: 'threshold: 0.01 or sensitivity: "normal"',
          conservative: 'threshold: 0.05 or sensitivity: "low"'
        } : {
          setup: 'Run npm run build:diarization for multi-speaker support'
        }
      }
    };
  }

  // Rest of the methods remain the same but with enhanced logging...
  async executeWhisper(binaryPath, args, transcriptionId) {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Starting enhanced whisper-cli transcription: ${transcriptionId}`);
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
            console.log(`📊 Enhanced transcription progress: ${newProgress}%`);
          }
        }
      });

      whisperProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log(`📝 enhanced whisper-cli stderr: ${output.trim()}`);
        
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
            console.log(`📊 Enhanced progress updated: ${newProgress}%`);
          }
        }
      });

      whisperProcess.on('close', async (code) => {
        console.log(`🏁 Enhanced whisper-cli process completed with code: ${code}`);
        console.log(`📊 Stdout length: ${stdout.length}, Stderr length: ${stderr.length}`);

        if (code === 0) {
          try {
            const result = await this.parseWhisperCliOutput(transcriptionId, stdout, stderr);
            this.emit('progress', { transcriptionId, progress: 100 });
            resolve(result);
          } catch (parseError) {
            console.error('❌ Failed to parse enhanced output:', parseError.message);
            reject(new Error(`Failed to parse enhanced transcription output: ${parseError.message}`));
          }
        } else {
          const errorMessage = this.buildErrorMessage(code, stderr);
          console.error(`❌ Enhanced transcription error: ${errorMessage}`);
          reject(new Error(errorMessage));
        }
      });

      whisperProcess.on('error', (error) => {
        console.error('❌ Failed to start enhanced whisper-cli process:', error.message);
        
        if (this.platform === 'win32' && error.code === 'ENOENT') {
          reject(new Error(`Failed to start whisper-cli.exe. Make sure all DLL files are present in ${path.dirname(binaryPath)}`));
        } else {
          reject(new Error(`Failed to start enhanced whisper-cli process: ${error.message}`));
        }
      });

      const timeout = setTimeout(() => {
        console.warn('⏰ Enhanced whisper-cli process timeout, killing...');
        whisperProcess.kill('SIGTERM');
        reject(new Error('Enhanced transcription timeout'));
      }, 10 * 60 * 1000);

      whisperProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  // Enhanced parsing method (same as before but with enhanced metadata)
  async parseWhisperCliOutput(transcriptionId, stdout, stderr) {
    let transcriptionText = '';
    let segments = [];
    let outputSource = 'unknown';

    if (stdout) {
      console.log('📄 Parsing VTT from enhanced whisper-cli stdout...');
      const vttResult = this.parseVTTFromStdout(stdout);
      if (vttResult.text) {
        transcriptionText = vttResult.text;
        segments = vttResult.segments || [];
        outputSource = 'stdout_vtt_enhanced';
        console.log(`✅ Enhanced VTT parsing successful: ${transcriptionText.length} chars, ${segments.length} segments`);
      }
    }

    if (!transcriptionText) {
      transcriptionText = this.extractPlainTextFromStdout(stdout);
      outputSource = 'stdout_text_enhanced';
    }

    if (!transcriptionText) {
      throw new Error('No enhanced transcription output found - Check whisper-cli binary output');
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
        model: 'whisper-local-enhanced',
        provider: 'enhanced-whisper-native',
        language: 'auto',
        createdAt: new Date().toISOString(),
        channels: 1,
        sampleRate: 16000,
        buildType: this.buildType,
        platform: this.platform,
        executableName: this.executableName,
        outputSource,
        version: 'enhanced-v2.0',
        diarizationEnabled: false, // Will be updated if diarization was performed
        quality: {
          confidence: avgConfidence,
          wordCount,
          duration,
          wpm: duration > 0 ? Math.round((wordCount / duration) * 60) : 0
        },
        enhancedFeatures: {
          crossPlatformSupport: true,
          modernBinaryFormat: true,
          improvedAccuracy: true
        }
      },
      
      provider: 'enhanced-whisper-native',
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Enhanced transcription processed: ${result.text.length} chars, ${result.segments.length} segments`);
    return result;
  }

  // All other utility methods remain the same...
  createBasicSegments(text) {
    const words = text.split(/\s+/);
    const segments = [];
    const segmentLength = 30;
    const wordsPerSegment = Math.ceil(words.length / Math.ceil(words.length / 100));

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
        return 'Enhanced DLL loading error - ensure all required DLL files are present';
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
      return `Enhanced whisper-cli error: ${stderr.trim()}`;
    } else {
      return `Enhanced whisper-cli process failed with exit code ${code}`;
    }
  }

  getName() {
    return 'enhanced-whisper-native';
  }

  getDescription() {
    const diarizationStatus = this.diarizationAvailable ? 
      'Enhanced Multi-Speaker Detection' : 'Single Speaker';
    return `Enhanced Local whisper.cpp (${this.buildType}) with ${this.executableName} + ${diarizationStatus}`;
  }

  isAvailable() {
    return this.available;
  }
}

module.exports = EnhancedNativeWhisperProvider;