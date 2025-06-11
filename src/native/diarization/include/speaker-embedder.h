// src/native/diarization/include/speaker-embedder.h
#pragma once

#include <vector>
#include <string>
#include <memory>
#include <onnxruntime_cxx_api.h>

/**
 * SpeakerEmbedder extracts speaker embeddings using ONNX models
 * Uses pyannote embedding models to create speaker representations
 */
class SpeakerEmbedder {
private:
    std::unique_ptr<Ort::Session> session_;
    Ort::Env env_;
    Ort::SessionOptions session_options_;
    Ort::MemoryInfo memory_info_;
    bool verbose_;
    
    // Model configuration
    size_t target_length_;    // Fixed input length in samples
    int sample_rate_;         // Expected sample rate
    size_t embedding_dim_;    // Dimension of output embeddings
    
    // Speaker clustering state
    std::vector<std::vector<float>> speaker_centroids_;
    std::vector<int> speaker_counts_;
    
public:
    explicit SpeakerEmbedder(bool verbose = false);
    ~SpeakerEmbedder();
    
    /**
     * Initialize the embedder with an ONNX model
     * @param model_path Path to the embedding ONNX model
     * @param sample_rate Audio sample rate (default: 16000)
     * @param target_duration Target audio duration in seconds (default: 3.0)
     * @return true if initialization successful
     */
    bool initialize(const std::string& model_path, int sample_rate = 16000, float target_duration = 3.0f);
    
    /**
     * Extract embedding from audio segment
     * @param audio_segment Input audio samples
     * @return Normalized embedding vector
     */
    std::vector<float> extract_embedding(const std::vector<float>& audio_segment);
    
    /**
     * Find or create speaker ID for given embedding
     * @param embedding Speaker embedding vector
     * @param threshold Similarity threshold for speaker matching
     * @param max_speakers Maximum number of speakers to track
     * @return Speaker ID (0-based)
     */
    int find_or_create_speaker(const std::vector<float>& embedding, float threshold, int max_speakers);
    
    /**
     * Calculate confidence score for speaker assignment
     * @param embedding Input embedding
     * @param speaker_id Target speaker ID
     * @return Confidence score [0, 1]
     */
    float calculate_confidence(const std::vector<float>& embedding, int speaker_id);
    
    /**
     * Get number of discovered speakers
     */
    size_t get_speaker_count() const { return speaker_centroids_.size(); }
    
    /**
     * Reset speaker clustering state
     */
    void reset_speakers();
    
    /**
     * Check if the embedder is properly initialized
     */
    bool is_initialized() const { return session_ != nullptr; }
    
    /**
     * Get embedding dimension
     */
    size_t get_embedding_dimension() const { return embedding_dim_; }
    
private:
    /**
     * Normalize embedding vector to unit length
     */
    void normalize_embedding(std::vector<float>& embedding);
    
    /**
     * Calculate cosine similarity between two embeddings
     */
    float cosine_similarity(const std::vector<float>& a, const std::vector<float>& b);
    
    /**
     * Prepare audio segment for embedding extraction
     * (pad/truncate to target length, normalize)
     */
    std::vector<float> prepare_audio_segment(const std::vector<float>& audio);
    
    /**
     * Update speaker centroid with new embedding
     */
    void update_speaker_centroid(int speaker_id, const std::vector<float>& embedding);
};