// src/native/diarization/include/speaker-segmenter.h
#pragma once

#include <vector>
#include <string>
#include <memory>
#include <onnxruntime_cxx_api.h>

/**
 * SpeakerSegmenter handles speaker change point detection using ONNX models
 * Uses pyannote segmentation models to identify when speakers change
 */
class SpeakerSegmenter {
private:
    std::unique_ptr<Ort::Session> session_;
    Ort::Env env_;
    Ort::SessionOptions session_options_;
    Ort::MemoryInfo memory_info_;
    bool verbose_;
    
    // Model configuration
    int window_size_;     // Input window size in samples
    int hop_size_;        // Hop size for sliding window
    int sample_rate_;     // Expected sample rate
    
public:
    explicit SpeakerSegmenter(bool verbose = false);
    ~SpeakerSegmenter();
    
    /**
     * Initialize the segmenter with an ONNX model
     * @param model_path Path to the segmentation ONNX model
     * @param sample_rate Audio sample rate (default: 16000)
     * @return true if initialization successful
     */
    bool initialize(const std::string& model_path, int sample_rate = 16000);
    
    /**
     * Detect speaker change points in audio
     * @param audio Input audio samples (normalized float)
     * @param threshold Minimum probability for speaker change detection
     * @return Vector of timestamps (in seconds) where speaker changes occur
     */
    std::vector<float> detect_change_points(const std::vector<float>& audio, float threshold = 0.5f);
    
    /**
     * Process a single audio window and return change probabilities
     * @param audio_window Audio samples for this window
     * @return Vector of change probabilities (one per time step)
     */
    std::vector<float> process_window(const std::vector<float>& audio_window);
    
    /**
     * Check if the segmenter is properly initialized
     */
    bool is_initialized() const { return session_ != nullptr; }
    
private:
    /**
     * Normalize audio window to [-1, 1] range
     */
    void normalize_audio(std::vector<float>& audio);
    
    /**
     * Find peaks in probability signal that indicate speaker changes
     */
    std::vector<float> find_peaks(const std::vector<float>& probabilities, 
                                  float threshold, 
                                  size_t window_start_sample,
                                  int samples_per_frame);
};