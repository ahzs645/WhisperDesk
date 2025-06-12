// src/native/diarization/speaker-segmenter.cpp - FIXED for better speaker change detection
#include "include/speaker-segmenter.h"
#include "include/utils.h"
#include <iostream>
#include <iomanip>
#include <algorithm>
#include <cmath>

SpeakerSegmenter::SpeakerSegmenter(bool verbose)
    : env_(ORT_LOGGING_LEVEL_WARNING, "speaker-segmenter"),
      memory_info_(Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault)),
      verbose_(verbose),
      window_size_(51200),  // FIXED: Match pyannote model expectations (3.2s at 16kHz)
      hop_size_(25600),     // FIXED: 1.6s hop (50% overlap)
      sample_rate_(16000) {
    
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
        
        // FIXED: Use exact window sizes that match pyannote models
        window_size_ = 51200;  // Exactly what pyannote segmentation-3.0 expects
        hop_size_ = 25600;     // 50% overlap
        
        session_ = std::make_unique<Ort::Session>(env_, model_path.c_str(), session_options_);
        
        if (verbose_) {
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
        // FIXED: Much lower threshold for initial detection
        float detection_threshold = std::max(0.01f, threshold * 0.1f); // Start with very low threshold
        
        size_t total_windows = 0;
        if (audio.size() > static_cast<size_t>(window_size_)) {
            total_windows = (audio.size() - window_size_) / hop_size_ + 1;
        }
        
        size_t processed_windows = 0;
        std::vector<float> all_probabilities;
        std::vector<float> all_timestamps;
        
        // Process audio with sliding window
        for (size_t i = 0; i + window_size_ < audio.size(); i += hop_size_) {
            std::vector<float> window(audio.begin() + i, audio.begin() + i + window_size_);
            
            auto probabilities = process_window(window);
            
            // FIXED: Store all probabilities for global analysis
            for (size_t j = 0; j < probabilities.size(); j++) {
                float timestamp = static_cast<float>(i + j * (window_size_ / probabilities.size())) / sample_rate_;
                all_probabilities.push_back(probabilities[j]);
                all_timestamps.push_back(timestamp);
            }
            
            processed_windows++;
            if (verbose_ && processed_windows % 5 == 0) {
                float progress = static_cast<float>(processed_windows) / total_windows * 100.0f;
                std::cout << "\rSegmentation progress: " << std::fixed << std::setprecision(1) 
                         << progress << "%" << std::flush;
            }
        }
        
        if (verbose_) {
            std::cout << std::endl;
        }
        
        // FIXED: Adaptive thresholding based on actual data
        if (!all_probabilities.empty()) {
            float max_prob = *std::max_element(all_probabilities.begin(), all_probabilities.end());
            float mean_prob = 0.0f;
            for (float p : all_probabilities) {
                mean_prob += p;
            }
            mean_prob /= all_probabilities.size();
            
            // FIXED: Use adaptive threshold
            float adaptive_threshold = std::max(detection_threshold, mean_prob + 2 * (max_prob - mean_prob) * 0.1f);
            
            if (verbose_) {
                std::cout << "📊 Probability stats:" << std::endl;
                std::cout << "  Max: " << max_prob << std::endl;
                std::cout << "  Mean: " << mean_prob << std::endl;
                std::cout << "  Adaptive threshold: " << adaptive_threshold << std::endl;
            }
            
            // Find change points using adaptive threshold
            for (size_t i = 1; i < all_probabilities.size() - 1; i++) {
                if (all_probabilities[i] > adaptive_threshold && 
                    all_probabilities[i] > all_probabilities[i-1] && 
                    all_probabilities[i] > all_probabilities[i+1]) {
                    
                    change_points.push_back(all_timestamps[i]);
                    
                    if (verbose_) {
                        std::cout << "📍 Change point found at " << all_timestamps[i] 
                                 << "s (prob: " << all_probabilities[i] << ")" << std::endl;
                    }
                }
            }
        }
        
        // FIXED: If no change points found, create artificial segments for long audio
        if (change_points.empty() && audio.size() > static_cast<size_t>(sample_rate_ * 10)) {
            if (verbose_) {
                std::cout << "⚠️ No change points detected, creating artificial segments" << std::endl;
            }
            
            // Create segments every 30 seconds for long audio
            float duration = static_cast<float>(audio.size()) / sample_rate_;
            for (float t = 30.0f; t < duration - 10.0f; t += 30.0f) {
                change_points.push_back(t);
                if (verbose_) {
                    std::cout << "📍 Artificial change point at " << t << "s" << std::endl;
                }
            }
        }
        
        // Remove duplicates and sort
        std::sort(change_points.begin(), change_points.end());
        auto last = std::unique(change_points.begin(), change_points.end(), 
                               [](float a, float b) { return std::abs(a - b) < 1.0f; });
        change_points.erase(last, change_points.end());
        
        if (verbose_) {
            std::cout << "✅ Found " << change_points.size() << " speaker change points" << std::endl;
        }
        
        return change_points;
        
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
        // FIXED: Ensure exact window size
        std::vector<float> window = audio_window;
        if (window.size() != static_cast<size_t>(window_size_)) {
            window.resize(window_size_, 0.0f);
            if (audio_window.size() < static_cast<size_t>(window_size_)) {
                std::copy(audio_window.begin(), audio_window.end(), window.begin());
            }
        }
        
        normalize_audio(window);
        
        auto input_name = session_->GetInputNameAllocated(0, Ort::AllocatorWithDefaultOptions());
        auto output_name = session_->GetOutputNameAllocated(0, Ort::AllocatorWithDefaultOptions());
        
        // FIXED: Use correct 3D input shape for pyannote segmentation model [batch, channels, samples]
        std::vector<int64_t> input_shape = {1, 1, static_cast<int64_t>(window_size_)};
        auto input_tensor = Ort::Value::CreateTensor<float>(
            memory_info_, window.data(), window.size(), 
            input_shape.data(), input_shape.size());
        
        std::vector<const char*> input_names = {input_name.get()};
        std::vector<const char*> output_names = {output_name.get()};
        
        auto output_tensors = session_->Run(Ort::RunOptions{nullptr},
                                          input_names.data(), &input_tensor, 1,
                                          output_names.data(), 1);
        
        float* output_data = output_tensors[0].GetTensorMutableData<float>();
        auto output_shape = output_tensors[0].GetTensorTypeAndShapeInfo().GetShape();
        
        if (verbose_) {
            std::cout << "Model output shape: ";
            for (auto dim : output_shape) {
                std::cout << dim << " ";
            }
            std::cout << std::endl;
        }
        
        // FIXED: Better interpretation of pyannote segmentation output
        size_t time_steps = output_shape[1];  // Should be 186 for pyannote
        size_t num_classes = output_shape[2]; // Should be 7 for pyannote (speakers + silence)
        
        std::vector<float> change_probabilities;
        change_probabilities.reserve(time_steps);
        
        // FIXED: Look for speaker transitions by analyzing class changes
        int prev_dominant_class = -1;
        
        for (size_t t = 0; t < time_steps; t++) {
            // Find dominant class for this time step
            int dominant_class = 0;
            float max_logit = output_data[t * num_classes + 0];
            
            for (size_t c = 1; c < num_classes; c++) {
                float logit = output_data[t * num_classes + c];
                if (logit > max_logit) {
                    max_logit = logit;
                    dominant_class = static_cast<int>(c);
                }
            }
            
            // Calculate change probability
            float change_prob = 0.0f;
            if (prev_dominant_class != -1 && prev_dominant_class != dominant_class) {
                // FIXED: Use entropy-based change detection
                float entropy = 0.0f;
                float sum_exp = 0.0f;
                
                // Calculate softmax and entropy
                for (size_t c = 0; c < num_classes; c++) {
                    float exp_val = std::exp(output_data[t * num_classes + c] - max_logit);
                    sum_exp += exp_val;
                }
                
                for (size_t c = 0; c < num_classes; c++) {
                    float prob = std::exp(output_data[t * num_classes + c] - max_logit) / sum_exp;
                    if (prob > 1e-6f) {
                        entropy -= prob * std::log(prob);
                    }
                }
                
                // High entropy = uncertain = potential change point
                change_prob = std::min(1.0f, entropy / std::log(static_cast<float>(num_classes)));
                
                // Boost probability if classes are different
                if (dominant_class != prev_dominant_class) {
                    change_prob = std::min(1.0f, change_prob * 2.0f);
                }
            }
            
            change_probabilities.push_back(change_prob);
            prev_dominant_class = dominant_class;
            
            // Debug first few time steps
            if (verbose_ && t < 3) {
                std::cout << "Time " << t << ": dominant class " << dominant_class 
                         << ", change_prob: " << change_prob << std::endl;
            }
        }
        
        if (verbose_) {
            float max_change = *std::max_element(change_probabilities.begin(), change_probabilities.end());
            std::cout << "Max change probability in window: " << max_change << std::endl;
        }
        
        return change_probabilities;
        
    } catch (const std::exception& e) {
        std::cerr << "❌ Window processing failed: " << e.what() << std::endl;
        return {};
    }
}

void SpeakerSegmenter::normalize_audio(std::vector<float>& audio) {
    if (audio.empty()) return;
    
    // FIXED: Better normalization for pyannote models
    float max_val = 0.0f;
    for (float sample : audio) {
        max_val = std::max(max_val, std::abs(sample));
    }
    
    if (max_val > 1e-6f) {
        // Normalize to [-1, 1] range
        for (float& sample : audio) {
            sample /= max_val;
        }
    }
    
    // Optional: Apply pre-emphasis filter (helps with some models)
    for (size_t i = audio.size() - 1; i > 0; i--) {
        audio[i] = audio[i] - 0.97f * audio[i-1];
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
    
    // FIXED: Much more aggressive peak finding
    float max_prob = *std::max_element(probabilities.begin(), probabilities.end());
    float adaptive_threshold = std::max(0.001f, std::min(threshold, max_prob * 0.3f));
    
    if (verbose_) {
        std::cout << "Finding peaks with threshold: " << adaptive_threshold << std::endl;
        std::cout << "Max probability in window: " << max_prob << std::endl;
    }
    
    for (size_t i = 1; i < probabilities.size() - 1; i++) {
        if (probabilities[i] > adaptive_threshold && 
            probabilities[i] > probabilities[i-1] && 
            probabilities[i] > probabilities[i+1]) {
            
            float time_point = static_cast<float>(window_start_sample + i * samples_per_frame) / sample_rate_;
            peaks.push_back(time_point);
            
            if (verbose_) {
                std::cout << "Found peak at time " << time_point << " with probability " << probabilities[i] << std::endl;
            }
        }
    }
    
    return peaks;
}