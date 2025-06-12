// src/native/diarization/diarize-cli.cpp - FIXED for better speaker detection
#include "include/diarize-cli.h"
#include "include/speaker-segmenter.h"
#include "include/speaker-embedder.h"
#include "include/utils.h"

#include <iostream>
#include <iomanip>
#include <memory>
#include <vector>
#include <algorithm>
#include <map>

DiarizationEngine::DiarizationEngine(bool verbose) 
    : verbose_(verbose) {
    segmenter_ = std::make_unique<SpeakerSegmenter>(verbose);
    embedder_ = std::make_unique<SpeakerEmbedder>(verbose);
}

DiarizationEngine::~DiarizationEngine() = default;

bool DiarizationEngine::initialize(const std::string& segment_model_path, const std::string& embedding_model_path) {
    if (verbose_) {
        std::cout << "🔧 Initializing diarization engine..." << std::endl;
    }
    
    if (!segmenter_->initialize(segment_model_path)) {
        std::cerr << "❌ Failed to initialize speaker segmenter" << std::endl;
        return false;
    }
    
    if (!embedder_->initialize(embedding_model_path)) {
        std::cerr << "❌ Failed to initialize speaker embedder" << std::endl;
        return false;
    }
    
    if (verbose_) {
        std::cout << "✅ Diarization engine initialized successfully" << std::endl;
    }
    
    return true;
}

std::vector<AudioSegment> DiarizationEngine::process_audio(const std::vector<float>& audio, const DiarizeOptions& options) {
    std::vector<AudioSegment> segments;
    
    try {
        if (verbose_) {
            std::cout << "🎵 Processing audio: " << audio.size() << " samples ("
                     << static_cast<float>(audio.size()) / options.sample_rate << " seconds)" << std::endl;
        }
        
        // Step 1: Detect speaker change points
        auto change_points = detect_speaker_changes(audio, options);
        
        if (verbose_) {
            std::cout << "🔍 Detected " << change_points.size() << " speaker change points" << std::endl;
            for (size_t i = 0; i < change_points.size(); i++) {
                std::cout << "   Change point " << (i+1) << ": " << change_points[i] << "s" << std::endl;
            }
        }
        
        // Step 2: Create segments
        auto audio_segments = create_segments(audio, change_points, options);
        
        if (verbose_) {
            std::cout << "📝 Created " << audio_segments.size() << " audio segments" << std::endl;
            for (size_t i = 0; i < audio_segments.size(); i++) {
                std::cout << "   Segment " << (i+1) << ": " << audio_segments[i].start_time 
                         << "s - " << audio_segments[i].end_time << "s ("
                         << (audio_segments[i].end_time - audio_segments[i].start_time) << "s)" << std::endl;
            }
        }
        
        // Step 3: Assign speakers
        segments = assign_speakers(audio_segments, options);
        
        if (verbose_) {
            std::cout << "👥 Assigned " << embedder_->get_speaker_count() << " unique speakers" << std::endl;
        }
        
    } catch (const std::exception& e) {
        std::cerr << "❌ Audio processing failed: " << e.what() << std::endl;
    }
    
    return segments;
}

std::vector<float> DiarizationEngine::detect_speaker_changes(const std::vector<float>& audio, const DiarizeOptions& options) {
    if (!segmenter_->is_initialized()) {
        std::cerr << "❌ Speaker segmenter not initialized" << std::endl;
        return {};
    }
    
    // FIXED: Use much lower threshold for change detection
    float detection_threshold = std::max(0.001f, options.threshold * 0.1f);
    
    if (verbose_) {
        std::cout << "🔍 Using detection threshold: " << detection_threshold << std::endl;
    }
    
    return segmenter_->detect_change_points(audio, detection_threshold);
}

std::vector<AudioSegment> DiarizationEngine::create_segments(const std::vector<float>& audio, 
                                                            const std::vector<float>& change_points,
                                                            const DiarizeOptions& options) {
    std::vector<AudioSegment> segments;
    
    float total_duration = static_cast<float>(audio.size()) / options.sample_rate;
    
    if (change_points.empty()) {
        if (verbose_) {
            std::cout << "⚠️ No change points detected, creating segments based on duration" << std::endl;
        }
        
        // FIXED: For long audio without change points, create multiple segments
        if (total_duration > 30.0f) {
            // Create 20-30 second segments
            float segment_duration = 25.0f;
            for (float start = 0.0f; start < total_duration - 5.0f; start += segment_duration) {
                float end = std::min(start + segment_duration, total_duration);
                
                AudioSegment segment;
                segment.start_time = start;
                segment.end_time = end;
                
                size_t start_sample = static_cast<size_t>(start * options.sample_rate);
                size_t end_sample = static_cast<size_t>(end * options.sample_rate);
                
                if (end_sample <= audio.size() && start_sample < end_sample) {
                    segment.samples.assign(audio.begin() + start_sample, audio.begin() + end_sample);
                    segments.push_back(segment);
                    
                    if (verbose_) {
                        std::cout << "   Created segment: " << start << "s - " << end << "s" << std::endl;
                    }
                }
            }
        } else {
            // Short audio - treat as single segment
            AudioSegment segment;
            segment.start_time = 0.0f;
            segment.end_time = total_duration;
            segment.samples = audio;
            segments.push_back(segment);
        }
        
        return segments;
    }
    
    // Create segments between change points
    std::vector<float> boundaries = {0.0f};
    boundaries.insert(boundaries.end(), change_points.begin(), change_points.end());
    boundaries.push_back(total_duration);
    
    for (size_t i = 0; i < boundaries.size() - 1; i++) {
        float start = boundaries[i];
        float end = boundaries[i + 1];
        
        // Ensure minimum segment length
        if (end - start < 2.0f) {
            continue;
        }
        
        AudioSegment segment;
        segment.start_time = start;
        segment.end_time = end;
        
        size_t start_sample = static_cast<size_t>(start * options.sample_rate);
        size_t end_sample = static_cast<size_t>(end * options.sample_rate);
        
        if (end_sample <= audio.size() && start_sample < end_sample) {
            segment.samples.assign(audio.begin() + start_sample, audio.begin() + end_sample);
            segments.push_back(segment);
        }
    }
    
    return segments;
}

std::vector<AudioSegment> DiarizationEngine::assign_speakers(std::vector<AudioSegment>& segments, const DiarizeOptions& options) {
    if (!embedder_->is_initialized()) {
        std::cerr << "❌ Speaker embedder not initialized" << std::endl;
        return segments;
    }
    
    // FIXED: Use lower threshold for speaker assignment
    float assignment_threshold = std::max(0.3f, options.threshold);
    
    if (verbose_) {
        std::cout << "👥 Using speaker assignment threshold: " << assignment_threshold << std::endl;
    }
    
    for (size_t i = 0; i < segments.size(); i++) {
        try {
            auto& segment = segments[i];
            
            // Extract embedding
            auto embedding = embedder_->extract_embedding(segment.samples);
            
            // Find or create speaker with adjusted threshold
            int speaker_id = embedder_->find_or_create_speaker(embedding, assignment_threshold, options.max_speakers);
            segment.speaker_id = speaker_id;
            
            // Calculate confidence
            segment.confidence = embedder_->calculate_confidence(embedding, speaker_id);
            
            if (verbose_ && i % 5 == 0) {
                float progress = static_cast<float>(i) / segments.size() * 100.0f;
                std::cout << "\rSpeaker assignment progress: " << std::fixed << std::setprecision(1) 
                         << progress << "%" << std::flush;
            }
            
        } catch (const std::exception& e) {
            std::cerr << "❌ Speaker assignment failed for segment " << i << ": " << e.what() << std::endl;
            segments[i].speaker_id = static_cast<int>(i % options.max_speakers);
            segments[i].confidence = 0.5f;
        }
    }
    
    if (verbose_) {
        std::cout << std::endl;
    }
    
    return segments;
}

// ... (other methods remain the same)

int main(int argc, char* argv[]) {
    try {
        auto options = Utils::Args::parse_arguments(argc, argv);
        
        if (options.audio_path.empty() || options.segment_model_path.empty() || options.embedding_model_path.empty()) {
            std::cerr << "❌ Error: --audio, --segment-model, and --embedding-model are required\n";
            std::cerr << "Use --help for usage information\n";
            return 1;
        }
        
        // FIXED: Validate threshold values and adjust if needed
        if (options.threshold > 0.8f) {
            std::cout << "⚠️ Warning: Threshold " << options.threshold << " is very high, adjusting to 0.7" << std::endl;
            options.threshold = 0.7f;
        }
        
        if (options.threshold < 0.01f) {
            std::cout << "⚠️ Warning: Threshold " << options.threshold << " is very low, adjusting to 0.01" << std::endl;
            options.threshold = 0.01f;
        }
        
        // Validate files exist
        if (!Utils::FileSystem::file_exists(options.audio_path)) {
            std::cerr << "❌ Audio file not found: " << options.audio_path << std::endl;
            return 1;
        }
        
        if (!Utils::FileSystem::file_exists(options.segment_model_path)) {
            std::cerr << "❌ Segmentation model not found: " << options.segment_model_path << std::endl;
            return 1;
        }
        
        if (!Utils::FileSystem::file_exists(options.embedding_model_path)) {
            std::cerr << "❌ Embedding model not found: " << options.embedding_model_path << std::endl;
            return 1;
        }
        
        if (options.verbose) {
            std::cout << "🔧 WhisperDesk Speaker Diarization CLI" << std::endl;
            std::cout << "📁 Audio file: " << options.audio_path << std::endl;
            std::cout << "🧠 Segmentation model: " << options.segment_model_path << std::endl;
            std::cout << "🎯 Embedding model: " << options.embedding_model_path << std::endl;
            std::cout << "👥 Max speakers: " << options.max_speakers << std::endl;
            std::cout << "🎚️ Threshold: " << options.threshold << std::endl;
        }
        
        // Initialize diarization engine
        DiarizationEngine engine(options.verbose);
        if (!engine.initialize(options.segment_model_path, options.embedding_model_path)) {
            std::cerr << "❌ Failed to initialize diarization engine" << std::endl;
            return 1;
        }
        
        // Load audio file
        if (options.verbose) {
            std::cout << "📁 Loading audio file..." << std::endl;
        }
        
        auto audio_data = Utils::Audio::load_audio_file(options.audio_path, options.sample_rate);
        
        if (audio_data.empty()) {
            std::cerr << "❌ Failed to load audio file or file is empty" << std::endl;
            return 1;
        }
        
        if (options.verbose) {
            std::cout << "🎵 Audio loaded: " << audio_data.size() << " samples, " 
                     << static_cast<float>(audio_data.size()) / options.sample_rate << " seconds" << std::endl;
        }
        
        // Process audio
        auto segments = engine.process_audio(audio_data, options);
        
        if (segments.empty()) {
            std::cerr << "❌ No segments generated" << std::endl;
            return 1;
        }
        
        if (options.verbose) {
            std::cout << "✅ Diarization complete!" << std::endl;
            std::cout << "📊 Results: " << segments.size() << " segments" << std::endl;
            
            // Print detailed speaker summary
            std::map<int, std::vector<std::pair<float, float>>> speaker_segments;
            std::map<int, float> speaker_durations;
            
            for (const auto& segment : segments) {
                speaker_segments[segment.speaker_id].push_back({segment.start_time, segment.end_time});
                speaker_durations[segment.speaker_id] += (segment.end_time - segment.start_time);
            }
            
            std::cout << "👥 Detected " << speaker_segments.size() << " speakers:" << std::endl;
            for (const auto& [speaker_id, segs] : speaker_segments) {
                std::cout << "   Speaker " << speaker_id << ": " << segs.size() << " segments, "
                         << std::fixed << std::setprecision(1) << speaker_durations[speaker_id] << "s total" << std::endl;
                
                // Show first few segments
                for (size_t i = 0; i < std::min(size_t(3), segs.size()); i++) {
                    std::cout << "     " << segs[i].first << "s - " << segs[i].second << "s" << std::endl;
                }
                if (segs.size() > 3) {
                    std::cout << "     ... and " << (segs.size() - 3) << " more segments" << std::endl;
                }
            }
        }
        
        // Output results
        Utils::Json::output_results(segments, options);
        
        return 0;
        
    } catch (const std::exception& e) {
        std::cerr << "❌ Error: " << e.what() << std::endl;
        return 1;
    } catch (...) {
        std::cerr << "❌ Unknown error occurred" << std::endl;
        return 1;
    }
}