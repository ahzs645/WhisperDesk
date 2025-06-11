// src/native/diarization/diarize-cli.cpp
// Modular main entry point using separated components

#include "include/diarize-cli.h"
#include "include/speaker-segmenter.h"
#include "include/speaker-embedder.h"
#include "include/utils.h"

#include <iostream>
#include <memory>
#include <vector>
#include <algorithm>

// DiarizationEngine implementation using modular components
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
    
    // Initialize segmenter
    if (!segmenter_->initialize(segment_model_path)) {
        std::cerr << "❌ Failed to initialize speaker segmenter" << std::endl;
        return false;
    }
    
    // Initialize embedder  
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
        
        // Step 1: Detect speaker change points using segmenter
        auto change_points = detect_speaker_changes(audio, options);
        
        if (verbose_) {
            std::cout << "🔍 Detected " << change_points.size() << " speaker change points" << std::endl;
        }
        
        // Step 2: Create segments based on change points
        auto audio_segments = create_segments(audio, change_points, options);
        
        if (verbose_) {
            std::cout << "📝 Created " << audio_segments.size() << " audio segments" << std::endl;
        }
        
        // Step 3: Extract embeddings and assign speakers using embedder
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
    
    return segmenter_->detect_change_points(audio, 0.5f); // Use default threshold for segmentation
}

std::vector<AudioSegment> DiarizationEngine::create_segments(const std::vector<float>& audio, 
                                                            const std::vector<float>& change_points,
                                                            const DiarizeOptions& options) {
    std::vector<AudioSegment> segments;
    
    if (change_points.empty()) {
        // If no change points, treat entire audio as one segment
        AudioSegment segment;
        segment.start_time = 0.0f;
        segment.end_time = static_cast<float>(audio.size()) / options.sample_rate;
        segment.samples = audio;
        segments.push_back(segment);
        return segments;
    }
    
    // Create segments between change points
    float prev_time = 0.0f;
    for (float change_time : change_points) {
        if (change_time - prev_time > 0.5f) { // Minimum 0.5s segments
            AudioSegment segment;
            segment.start_time = prev_time;
            segment.end_time = change_time;
            
            size_t start_sample = static_cast<size_t>(prev_time * options.sample_rate);
            size_t end_sample = static_cast<size_t>(change_time * options.sample_rate);
            
            if (end_sample <= audio.size() && start_sample < end_sample) {
                segment.samples.assign(audio.begin() + start_sample, audio.begin() + end_sample);
                segments.push_back(segment);
            }
        }
        prev_time = change_time;
    }
    
    // Add final segment
    if (prev_time < static_cast<float>(audio.size()) / options.sample_rate) {
        AudioSegment segment;
        segment.start_time = prev_time;
        segment.end_time = static_cast<float>(audio.size()) / options.sample_rate;
        
        size_t start_sample = static_cast<size_t>(prev_time * options.sample_rate);
        segment.samples.assign(audio.begin() + start_sample, audio.end());
        segments.push_back(segment);
    }
    
    return segments;
}

std::vector<AudioSegment> DiarizationEngine::assign_speakers(std::vector<AudioSegment>& segments, const DiarizeOptions& options) {
    if (!embedder_->is_initialized()) {
        std::cerr << "❌ Speaker embedder not initialized" << std::endl;
        return segments;
    }
    
    for (size_t i = 0; i < segments.size(); i++) {
        try {
            auto& segment = segments[i];
            
            // Extract embedding for this segment
            auto embedding = embedder_->extract_embedding(segment.samples);
            
            // Find or create speaker
            int speaker_id = embedder_->find_or_create_speaker(embedding, options.threshold, options.max_speakers);
            segment.speaker_id = speaker_id;
            
            // Calculate confidence
            segment.confidence = embedder_->calculate_confidence(embedding, speaker_id);
            
            // Progress indication
            if (verbose_ && i % 10 == 0) {
                float progress = static_cast<float>(i) / segments.size() * 100.0f;
                std::cout << "\rSpeaker assignment progress: " << std::fixed << std::setprecision(1) 
                         << progress << "%" << std::flush;
            }
            
        } catch (const std::exception& e) {
            std::cerr << "❌ Speaker assignment failed for segment " << i << ": " << e.what() << std::endl;
            segments[i].speaker_id = 0;  // Default speaker
            segments[i].confidence = 0.5f;
        }
    }
    
    if (verbose_) {
        std::cout << std::endl; // New line after progress
    }
    
    return segments;
}

int DiarizationEngine::find_or_create_speaker(const std::vector<float>& embedding, float threshold, int max_speakers) {
    // This is now handled by the embedder
    return embedder_->find_or_create_speaker(embedding, threshold, max_speakers);
}

float DiarizationEngine::calculate_confidence(const std::vector<float>& embedding, int speaker_id) {
    // This is now handled by the embedder
    return embedder_->calculate_confidence(embedding, speaker_id);
}

float DiarizationEngine::cosine_similarity(const std::vector<float>& a, const std::vector<float>& b) {
    return Utils::Math::cosine_similarity(a, b);
}

// Main entry point
int main(int argc, char* argv[]) {
    try {
        // Parse command line arguments
        auto options = Utils::Args::parse_arguments(argc, argv);
        
        // Validate required arguments
        if (options.audio_path.empty() || options.segment_model_path.empty() || options.embedding_model_path.empty()) {
            std::cerr << "❌ Error: --audio, --segment-model, and --embedding-model are required\n";
            std::cerr << "Use --help for usage information\n";
            return 1;
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
            
            // Print speaker summary
            std::map<int, int> speaker_counts;
            for (const auto& segment : segments) {
                speaker_counts[segment.speaker_id]++;
            }
            
            std::cout << "👥 Detected " << speaker_counts.size() << " speakers:" << std::endl;
            for (const auto& [speaker_id, count] : speaker_counts) {
                std::cout << "   Speaker " << speaker_id << ": " << count << " segments" << std::endl;
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