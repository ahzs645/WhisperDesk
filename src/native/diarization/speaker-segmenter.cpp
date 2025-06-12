// src/native/diarization/speaker-segmenter.cpp - FIXED: Added missing iomanip header
#include "include/speaker-segmenter.h"
#include "include/utils.h"
#include <iostream>
#include <iomanip>    // ← FIXED: Added missing header for std::setprecision
#include <algorithm>
#include <cmath>

SpeakerSegmenter::SpeakerSegmenter(bool verbose)
    : env_(ORT_LOGGING_LEVEL_WARNING, "speaker-segmenter"),
      memory_info_(Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault)),
      verbose_(verbose),
      window_size_(512 * 160),  // ~3.2 seconds at 16kHz
      hop_size_(256 * 160),     // ~1.6 seconds hop
      sample_rate_(16000) {
    
    // Configure session options for optimal performance
    session_options_.SetIntraOpNumThreads(4);
    session_options_.SetGraphOptimizationLevel(GraphOptimizationLevel::ORT_ENABLE_ALL);
    session_options_.SetExecutionMode(ExecutionMode::ORT_SEQUENTIAL);
    session_options_.EnableCpuMemArena();
    session_options_.EnableMemPattern();
}

SpeakerSegmenter::~SpeakerSegmenter() = default;

bool SpeakerSegmenter::initialize(const std::string& model_path, int sample_rate) {
    try {
        if (verbose_) {
            std::cout << "Loading segmentation model: " << model_path << std::endl;
        }
        
        sample_rate_ = sample_rate;
        
        // Adjust window and hop sizes based on sample rate
        window_size_ = static_cast<int>(3.2 * sample_rate);  // 3.2 seconds
        hop_size_ = static_cast<int>(1.6 * sample_rate);     // 1.6 seconds
        
        // Load ONNX model
        session_ = std::make_unique<Ort::Session>(env_, model_path.c_str(), session_options_);
        
        if (verbose_) {
            // Print model input/output info
            auto input_count = session_->GetInputCount();
            auto output_count = session_->GetOutputCount();
            
            std::cout << "Segmentation model loaded:" << std::endl;
            std::cout << "  Inputs: " << input_count << std::endl;
            std::cout << "  Outputs: " << output_count << std::endl;
            std::cout << "  Window size: " << window_size_ << " samples" << std::endl;
            std::cout << "  Hop size: " << hop_size_ << " samples" << std::endl;
        }
        
        return true;
        
    } catch (const std::exception& e) {
        std::cerr << "❌ Failed to load segmentation model: " << e.what() << std::endl;
        return false;
    }
}

std::vector<float> SpeakerSegmenter::detect_change_points(const std::vector<float>& audio, float threshold) {
    if (!is_initialized()) {
        std::cerr << "❌ Segmenter not initialized" << std::endl;
        return {};
    }
    
    std::vector<float> change_points;
    
    if (verbose_) {
        std::cout << "Detecting speaker changes in " << audio.size() << " samples..." << std::endl;
    }
    
    try {
        size_t total_windows = 0;
        if (audio.size() > static_cast<size_t>(window_size_)) {
            total_windows = (audio.size() - window_size_) / hop_size_ + 1;
        }
        
        size_t processed_windows = 0;
        
        // Process audio with sliding window
        for (size_t i = 0; i + window_size_ < audio.size(); i += hop_size_) {
            // Extract window
            std::vector<float> window(audio.begin() + i, audio.begin() + i + window_size_);
            
            // Process window to get change probabilities
            auto probabilities = process_window(window);
            
            // Find peaks (speaker changes) in this window
            auto window_changes = find_peaks(probabilities, threshold, i, window_size_ / probabilities.size());
            
            // Add to global change points
            change_points.insert(change_points.end(), window_changes.begin(), window_changes.end());
            
            // Progress reporting - FIXED: Now works with proper iomanip header
            processed_windows++;
            if (verbose_ && processed_windows % 10 == 0) {
                float progress = static_cast<float>(processed_windows) / total_windows * 100.0f;
                std::cout << "\rSegmentation progress: " << std::fixed << std::setprecision(1) 
                         << progress << "%" << std::flush;
            }
        }
        
        if (verbose_) {
            std::cout << std::endl; // New line after progress
            std::cout << "Found " << change_points.size() << " speaker change points" << std::endl;
        }
        
        // Remove duplicate change points that are too close together
        std::sort(change_points.begin(), change_points.end());
        
        std::vector<float> filtered_changes;
        float min_gap = 0.5f; // Minimum 0.5 seconds between changes
        
        for (float change : change_points) {
            if (filtered_changes.empty() || change - filtered_changes.back() > min_gap) {
                filtered_changes.push_back(change);
            }
        }
        
        if (verbose_ && filtered_changes.size() != change_points.size()) {
            std::cout << "Filtered to " << filtered_changes.size() << " change points (removed duplicates)" << std::endl;
        }
        
        return filtered_changes;
        
    } catch (const std::exception& e) {
        std::cerr << "❌ Speaker change detection failed: " << e.what() << std::endl;
        return {};
    }
}

std::vector<float> SpeakerSegmenter::process_window(const std::vector<float>& audio_window) {
    if (!is_initialized()) {
        return {};
    }
    
    try {
        // Ensure window is the right size
        std::vector<float> window = audio_window;
        if (window.size() != static_cast<size_t>(window_size_)) {
            window.resize(window_size_, 0.0f);
            if (audio_window.size() < static_cast<size_t>(window_size_)) {
                std::copy(audio_window.begin(), audio_window.end(), window.begin());
            }
        }
        
        // Normalize audio
        normalize_audio(window);
        
        // FIXED: Get actual input/output names from the model
        auto input_name = session_->GetInputNameAllocated(0, Ort::AllocatorWithDefaultOptions());
        auto output_name = session_->GetOutputNameAllocated(0, Ort::AllocatorWithDefaultOptions());
        
        if (verbose_) {
            std::cout << "Using input name: " << input_name.get() << std::endl;
            std::cout << "Using output name: " << output_name.get() << std::endl;
        }
        
        // Prepare input tensor (batch_size=1, channels=1, samples=window_size)
        std::vector<int64_t> input_shape = {1, 1, static_cast<int64_t>(window_size_)};
        auto input_tensor = Ort::Value::CreateTensor<float>(
            memory_info_, window.data(), window.size(), 
            input_shape.data(), input_shape.size());
        
        // Run inference with correct names
        std::vector<const char*> input_names = {input_name.get()};
        std::vector<const char*> output_names = {output_name.get()};
        
        auto output_tensors = session_->Run(Ort::RunOptions{nullptr},
                                          input_names.data(), &input_tensor, 1,
                                          output_names.data(), 1);
        
        // Extract probabilities
        float* output_data = output_tensors[0].GetTensorMutableData<float>();
        auto output_shape = output_tensors[0].GetTensorTypeAndShapeInfo().GetShape();
        
        size_t output_length = 1;
        for (auto dim : output_shape) {
            output_length *= static_cast<size_t>(dim);
        }
        
        std::vector<float> probabilities(output_data, output_data + output_length);
        
        return probabilities;
        
    } catch (const std::exception& e) {
        std::cerr << "❌ Window processing failed: " << e.what() << std::endl;
        return {};
    }
}

void SpeakerSegmenter::normalize_audio(std::vector<float>& audio) {
    if (audio.empty()) return;
    
    // Find max absolute value
    float max_val = 0.0f;
    for (float sample : audio) {
        max_val = std::max(max_val, std::abs(sample));
    }
    
    // Normalize if max value is significant
    if (max_val > 1e-6f) {
        for (float& sample : audio) {
            sample /= max_val;
        }
    }
}

std::vector<float> SpeakerSegmenter::find_peaks(const std::vector<float>& probabilities, 
                                               float threshold, 
                                               size_t window_start_sample,
                                               int samples_per_frame) {
    std::vector<float> peaks;
    
    if (probabilities.size() < 3) {
        return peaks;
    }
    
    // Find local maxima above threshold
    for (size_t i = 1; i < probabilities.size() - 1; i++) {
        if (probabilities[i] > threshold && 
            probabilities[i] > probabilities[i-1] && 
            probabilities[i] > probabilities[i+1]) {
            
            // Convert frame index to time
            float time_point = static_cast<float>(window_start_sample + i * samples_per_frame) / sample_rate_;
            peaks.push_back(time_point);
        }
    }
    
    return peaks;
}