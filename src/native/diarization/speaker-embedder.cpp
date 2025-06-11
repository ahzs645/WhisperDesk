// src/native/diarization/speaker-embedder.cpp
#include "include/speaker-embedder.h"
#include "include/utils.h"
#include <iostream>
#include <algorithm>
#include <cmath>

SpeakerEmbedder::SpeakerEmbedder(bool verbose)
    : env_(ORT_LOGGING_LEVEL_WARNING, "speaker-embedder"),
      memory_info_(Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault)),
      verbose_(verbose),
      target_length_(48000),  // 3 seconds at 16kHz
      sample_rate_(16000),
      embedding_dim_(512) {   // Default embedding dimension
    
    // Configure session options for optimal performance
    session_options_.SetIntraOpNumThreads(4);
    session_options_.SetGraphOptimizationLevel(GraphOptimizationLevel::ORT_ENABLE_ALL);
    session_options_.SetExecutionMode(ExecutionMode::ORT_SEQUENTIAL);
    session_options_.EnableCpuMemArena();
    session_options_.EnableMemPattern();
}

SpeakerEmbedder::~SpeakerEmbedder() = default;

bool SpeakerEmbedder::initialize(const std::string& model_path, int sample_rate, float target_duration) {
    try {
        if (verbose_) {
            std::cout << "Loading embedding model: " << model_path << std::endl;
        }
        
        sample_rate_ = sample_rate;
        target_length_ = static_cast<size_t>(target_duration * sample_rate);
        
        // Load ONNX model
        session_ = std::make_unique<Ort::Session>(env_, model_path.c_str(), session_options_);
        
        // Get output shape to determine embedding dimension
        auto output_info = session_->GetOutputTypeInfo(0);
        auto tensor_info = output_info.GetTensorTypeAndShapeInfo();
        auto shape = tensor_info.GetShape();
        
        // Calculate embedding dimension (product of all dimensions except batch)
        embedding_dim_ = 1;
        for (size_t i = 1; i < shape.size(); i++) {
            embedding_dim_ *= static_cast<size_t>(shape[i]);
        }
        
        if (verbose_) {
            auto input_count = session_->GetInputCount();
            auto output_count = session_->GetOutputCount();
            
            std::cout << "Embedding model loaded:" << std::endl;
            std::cout << "  Inputs: " << input_count << std::endl;
            std::cout << "  Outputs: " << output_count << std::endl;
            std::cout << "  Target length: " << target_length_ << " samples" << std::endl;
            std::cout << "  Embedding dimension: " << embedding_dim_ << std::endl;
        }
        
        return true;
        
    } catch (const std::exception& e) {
        std::cerr << "❌ Failed to load embedding model: " << e.what() << std::endl;
        return false;
    }
}

std::vector<float> SpeakerEmbedder::extract_embedding(const std::vector<float>& audio_segment) {
    if (!is_initialized()) {
        std::cerr << "❌ Embedder not initialized" << std::endl;
        return std::vector<float>(embedding_dim_, 0.0f);
    }
    
    try {
        // Prepare audio segment (pad/truncate and normalize)
        auto prepared_audio = prepare_audio_segment(audio_segment);
        
        // Create input tensor (batch_size=1, channels=1, samples=target_length)
        std::vector<int64_t> input_shape = {1, 1, static_cast<int64_t>(target_length_)};
        auto input_tensor = Ort::Value::CreateTensor<float>(
            memory_info_, prepared_audio.data(), prepared_audio.size(),
            input_shape.data(), input_shape.size());
        
        // Run inference
        std::vector<const char*> input_names = {"input"};
        std::vector<const char*> output_names = {"output"};
        
        auto output_tensors = session_->Run(Ort::RunOptions{nullptr},
                                          input_names.data(), &input_tensor, 1,
                                          output_names.data(), 1);
        
        // Extract embedding
        float* output_data = output_tensors[0].GetTensorMutableData<float>();
        std::vector<float> embedding(output_data, output_data + embedding_dim_);
        
        // Normalize embedding to unit length
        normalize_embedding(embedding);
        
        return embedding;
        
    } catch (const std::exception& e) {
        std::cerr << "❌ Embedding extraction failed: " << e.what() << std::endl;
        return std::vector<float>(embedding_dim_, 0.0f);
    }
}

int SpeakerEmbedder::find_or_create_speaker(const std::vector<float>& embedding, float threshold, int max_speakers) {
    float best_similarity = -1.0f;
    int best_speaker = -1;
    
    // Compare with existing speakers
    for (size_t i = 0; i < speaker_centroids_.size(); i++) {
        float similarity = cosine_similarity(embedding, speaker_centroids_[i]);
        if (similarity > best_similarity) {
            best_similarity = similarity;
            best_speaker = static_cast<int>(i);
        }
    }
    
    // If similarity is above threshold, assign to existing speaker
    if (best_similarity > threshold && best_speaker >= 0) {
        update_speaker_centroid(best_speaker, embedding);
        return best_speaker;
    }
    
    // Create new speaker if under limit
    if (static_cast<int>(speaker_centroids_.size()) < max_speakers) {
        speaker_centroids_.push_back(embedding);
        speaker_counts_.push_back(1);
        
        if (verbose_) {
            std::cout << "Created new speaker " << (speaker_centroids_.size() - 1) 
                     << " (similarity: " << best_similarity << ")" << std::endl;
        }
        
        return static_cast<int>(speaker_centroids_.size() - 1);
    }
    
    // Otherwise assign to closest speaker
    if (best_speaker >= 0) {
        update_speaker_centroid(best_speaker, embedding);
        return best_speaker;
    }
    
    return 0; // Fallback to speaker 0
}

float SpeakerEmbedder::calculate_confidence(const std::vector<float>& embedding, int speaker_id) {
    if (speaker_id < 0 || static_cast<size_t>(speaker_id) >= speaker_centroids_.size()) {
        return 0.5f; // Default confidence
    }
    
    float similarity = cosine_similarity(embedding, speaker_centroids_[speaker_id]);
    return (similarity + 1.0f) / 2.0f; // Convert from [-1,1] to [0,1]
}

void SpeakerEmbedder::reset_speakers() {
    speaker_centroids_.clear();
    speaker_counts_.clear();
    
    if (verbose_) {
        std::cout << "Speaker clustering state reset" << std::endl;
    }
}

void SpeakerEmbedder::normalize_embedding(std::vector<float>& embedding) {
    if (embedding.empty()) return;
    
    // Calculate L2 norm
    float norm = 0.0f;
    for (float val : embedding) {
        norm += val * val;
    }
    norm = std::sqrt(norm);
    
    // Normalize if norm is significant
    if (norm > 1e-6f) {
        for (float& val : embedding) {
            val /= norm;
        }
    }
}

float SpeakerEmbedder::cosine_similarity(const std::vector<float>& a, const std::vector<float>& b) {
    if (a.size() != b.size() || a.empty()) {
        return 0.0f;
    }
    
    float dot_product = 0.0f;
    for (size_t i = 0; i < a.size(); i++) {
        dot_product += a[i] * b[i];
    }
    
    // Assuming vectors are already normalized, dot product = cosine similarity
    return std::max(-1.0f, std::min(1.0f, dot_product));
}

std::vector<float> SpeakerEmbedder::prepare_audio_segment(const std::vector<float>& audio) {
    std::vector<float> prepared(target_length_, 0.0f);
    
    // Copy audio data (pad with zeros if too short, truncate if too long)
    size_t copy_length = std::min(audio.size(), target_length_);
    std::copy(audio.begin(), audio.begin() + copy_length, prepared.begin());
    
    // Normalize audio
    float max_val = 0.0f;
    for (float sample : prepared) {
        max_val = std::max(max_val, std::abs(sample));
    }
    
    if (max_val > 1e-6f) {
        for (float& sample : prepared) {
            sample /= max_val;
        }
    }
    
    return prepared;
}

void SpeakerEmbedder::update_speaker_centroid(int speaker_id, const std::vector<float>& embedding) {
    if (speaker_id < 0 || static_cast<size_t>(speaker_id) >= speaker_centroids_.size()) {
        return;
    }
    
    auto& centroid = speaker_centroids_[speaker_id];
    int& count = speaker_counts_[speaker_id];
    
    // Update centroid using running average
    for (size_t i = 0; i < embedding.size() && i < centroid.size(); i++) {
        centroid[i] = (centroid[i] * count + embedding[i]) / (count + 1);
    }
    
    count++;
    
    // Re-normalize centroid
    normalize_embedding(centroid);
}