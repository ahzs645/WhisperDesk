// src/native/diarization/utils.cpp
#include "include/utils.h"
#include "include/diarize-cli.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <algorithm>
#include <cmath>
#include <iomanip>
#include <chrono>
#include <json/json.h>

#ifdef USE_LIBSNDFILE
#include <sndfile.h>
#endif

namespace Utils {

// Audio I/O functions
namespace Audio {

std::vector<float> load_audio_file(const std::string& file_path, int target_sample_rate) {
#ifdef USE_LIBSNDFILE
    SF_INFO sf_info;
    SNDFILE* sf_file = sf_open(file_path.c_str(), SFM_READ, &sf_info);
    
    if (!sf_file) {
        throw std::runtime_error("Failed to open audio file: " + file_path);
    }
    
    // Read all samples
    std::vector<float> temp_buffer(sf_info.frames * sf_info.channels);
    sf_count_t samples_read = sf_readf_float(sf_file, temp_buffer.data(), sf_info.frames);
    sf_close(sf_file);
    
    // Convert to mono
    std::vector<float> audio_data(samples_read);
    for (sf_count_t i = 0; i < samples_read; i++) {
        float sample = 0.0f;
        for (int ch = 0; ch < sf_info.channels; ch++) {
            sample += temp_buffer[i * sf_info.channels + ch];
        }
        audio_data[i] = sample / sf_info.channels;
    }
    
    // Resample if needed
    if (sf_info.samplerate != target_sample_rate) {
        audio_data = simple_resample(audio_data, sf_info.samplerate, target_sample_rate);
    }
    
    return audio_data;
#else
    // Fallback to simple loading
    return load_audio_simple(file_path);
#endif
}

std::vector<float> load_audio_simple(const std::string& file_path) {
    std::ifstream file(file_path, std::ios::binary);
    if (!file) {
        throw std::runtime_error("Cannot open audio file: " + file_path);
    }
    
    // Get file size
    file.seekg(0, std::ios::end);
    size_t file_size = file.tellg();
    file.seekg(0, std::ios::beg);
    
    // Read raw data (assuming 16-bit PCM)
    std::vector<int16_t> raw_data(file_size / sizeof(int16_t));
    file.read(reinterpret_cast<char*>(raw_data.data()), file_size);
    
    // Convert to float
    std::vector<float> audio_data;
    audio_data.reserve(raw_data.size());
    for (int16_t sample : raw_data) {
        audio_data.push_back(static_cast<float>(sample) / 32768.0f);
    }
    
    return audio_data;
}

void normalize_audio(std::vector<float>& audio) {
    if (audio.empty()) return;
    
    float max_val = 0.0f;
    for (float sample : audio) {
        max_val = std::max(max_val, std::abs(sample));
    }
    
    if (max_val > 1e-6f) {
        for (float& sample : audio) {
            sample /= max_val;
        }
    }
}

std::vector<float> simple_resample(const std::vector<float>& audio, int source_rate, int target_rate) {
    if (source_rate == target_rate) {
        return audio;
    }
    
    float ratio = static_cast<float>(target_rate) / source_rate;
    std::vector<float> resampled;
    resampled.reserve(static_cast<size_t>(audio.size() * ratio));
    
    for (size_t i = 0; i < audio.size(); i++) {
        float src_idx = i / ratio;
        if (src_idx < audio.size() - 1) {
            resampled.push_back(audio[static_cast<size_t>(src_idx)]);
        }
    }
    
    return resampled;
}

} // namespace Audio

// JSON output formatting
namespace Json {

void output_results(const std::vector<AudioSegment>& segments, const DiarizeOptions& options) {
    Json::Value root;
    Json::Value segments_json(Json::arrayValue);
    
    auto speaker_stats = generate_speaker_stats(segments);
    
    for (const auto& segment : segments) {
        Json::Value seg;
        seg["start_time"] = segment.start_time;
        seg["end_time"] = segment.end_time;
        seg["speaker_id"] = segment.speaker_id;
        seg["confidence"] = segment.confidence;
        seg["duration"] = segment.end_time - segment.start_time;
        
        if (!segment.text.empty()) {
            seg["text"] = segment.text;
        }
        
        segments_json.append(seg);
    }
    
    root["segments"] = segments_json;
    root["total_speakers"] = static_cast<int>(speaker_stats.size());
    root["total_duration"] = segments.empty() ? 0.0f : segments.back().end_time;
    root["audio_path"] = options.audio_path;
    root["created_at"] = Time::get_current_timestamp();
    
    // Add model info
    Json::Value model_info;
    model_info["segment_model"] = options.segment_model_path;
    model_info["embedding_model"] = options.embedding_model_path;
    model_info["max_speakers"] = options.max_speakers;
    model_info["threshold"] = options.threshold;
    root["model_info"] = model_info;
    
    // Add speaker statistics
    Json::Value speakers_json(Json::arrayValue);
    for (const auto& [speaker_id, stats] : speaker_stats) {
        Json::Value speaker;
        speaker["speaker_id"] = speaker_id;
        speaker["segment_count"] = static_cast<int>(stats.at("segment_count"));
        speaker["total_duration"] = stats.at("total_duration");
        speaker["average_confidence"] = stats.at("average_confidence");
        speakers_json.append(speaker);
    }
    root["speakers"] = speakers_json;
    
    // Output to file or stdout
    if (options.output_file.empty()) {
        std::cout << root << std::endl;
    } else {
        std::ofstream output_file(options.output_file);
        if (output_file) {
            output_file << root << std::endl;
            if (options.verbose) {
                std::cout << "Results written to: " << options.output_file << std::endl;
            }
        } else {
            std::cerr << "Failed to write output file: " << options.output_file << std::endl;
            std::cout << root << std::endl;
        }
    }
}

std::map<int, std::map<std::string, float>> generate_speaker_stats(const std::vector<AudioSegment>& segments) {
    std::map<int, std::map<std::string, float>> stats;
    
    for (const auto& segment : segments) {
        int speaker_id = segment.speaker_id;
        float duration = segment.end_time - segment.start_time;
        
        if (stats.find(speaker_id) == stats.end()) {
            stats[speaker_id] = {
                {"segment_count", 0.0f},
                {"total_duration", 0.0f},
                {"confidence_sum", 0.0f},
                {"average_confidence", 0.0f}
            };
        }
        
        stats[speaker_id]["segment_count"] += 1.0f;
        stats[speaker_id]["total_duration"] += duration;
        stats[speaker_id]["confidence_sum"] += segment.confidence;
    }
    
    // Calculate averages
    for (auto& [speaker_id, speaker_stats] : stats) {
        float segment_count = speaker_stats["segment_count"];
        if (segment_count > 0) {
            speaker_stats["average_confidence"] = speaker_stats["confidence_sum"] / segment_count;
        }
    }
    
    return stats;
}

} // namespace Json

// Command line argument parsing
namespace Args {

DiarizeOptions parse_arguments(int argc, char* argv[]) {
    DiarizeOptions options;
    
    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        
        if (arg == "--audio" && i + 1 < argc) {
            options.audio_path = argv[++i];
        } else if (arg == "--segment-model" && i + 1 < argc) {
            options.segment_model_path = argv[++i];
        } else if (arg == "--embedding-model" && i + 1 < argc) {
            options.embedding_model_path = argv[++i];
        } else if (arg == "--max-speakers" && i + 1 < argc) {
            options.max_speakers = std::stoi(argv[++i]);
        } else if (arg == "--threshold" && i + 1 < argc) {
            options.threshold = std::stof(argv[++i]);
        } else if (arg == "--output-format" && i + 1 < argc) {
            options.output_format = argv[++i];
        } else if (arg == "--output" && i + 1 < argc) {
            options.output_file = argv[++i];
        } else if (arg == "--verbose") {
            options.verbose = true;
        } else if (arg == "--help" || arg == "-h") {
            print_help();
            exit(0);
        } else if (arg == "--version" || arg == "-v") {
            print_version();
            exit(0);
        }
    }
    
    return options;
}

void print_help() {
    std::cout << "WhisperDesk Speaker Diarization CLI\n\n"
              << "USAGE:\n"
              << "    diarize-cli [OPTIONS]\n\n"
              << "REQUIRED:\n"
              << "    --audio <PATH>              Input audio file\n"
              << "    --segment-model <PATH>      Segmentation ONNX model\n"
              << "    --embedding-model <PATH>    Embedding ONNX model\n\n"
              << "OPTIONS:\n"
              << "    --max-speakers <NUM>        Maximum speakers (default: 10)\n"
              << "    --threshold <FLOAT>         Speaker similarity threshold (default: 0.5)\n"
              << "    --output-format <FORMAT>    Output format: json (default: json)\n"
              << "    --output <PATH>             Output file (default: stdout)\n"
              << "    --verbose                   Verbose output\n"
              << "    --help, -h                  Show this help\n"
              << "    --version, -v               Show version\n\n"
              << "EXAMPLE:\n"
              << "    diarize-cli --audio recording.wav \\\n"
              << "                --segment-model segmentation-3.0.onnx \\\n"
              << "                --embedding-model embedding-1.0.onnx \\\n"
              << "                --max-speakers 5 \\\n"
              << "                --verbose\n\n"
              << "For more information, visit: https://github.com/whisperdesk/whisperdesk-enhanced\n";
}

void print_version() {
    std::cout << "WhisperDesk Speaker Diarization CLI v1.0.0\n"
              << "Built with ONNX Runtime for cross-platform compatibility\n"
              << "Copyright (c) 2024 WhisperDesk Team\n";
}

} // namespace Args

// File system utilities
namespace FileSystem {

bool file_exists(const std::string& file_path) {
    std::ifstream file(file_path);
    return file.good();
}

long get_file_size(const std::string& file_path) {
    std::ifstream file(file_path, std::ios::binary | std::ios::ate);
    if (!file) {
        return -1;
    }
    return static_cast<long>(file.tellg());
}

std::string get_file_extension(const std::string& file_path) {
    size_t dot_pos = file_path.find_last_of('.');
    if (dot_pos == std::string::npos) {
        return "";
    }
    return file_path.substr(dot_pos);
}

} // namespace FileSystem

// Math utilities
namespace Math {

float cosine_similarity(const std::vector<float>& a, const std::vector<float>& b) {
    if (a.size() != b.size() || a.empty()) {
        return 0.0f;
    }
    
    float dot_product = 0.0f;
    for (size_t i = 0; i < a.size(); i++) {
        dot_product += a[i] * b[i];
    }
    
    return std::max(-1.0f, std::min(1.0f, dot_product));
}

void normalize_vector(std::vector<float>& vec) {
    if (vec.empty()) return;
    
    float norm = 0.0f;
    for (float val : vec) {
        norm += val * val;
    }
    norm = std::sqrt(norm);
    
    if (norm > 1e-6f) {
        for (float& val : vec) {
            val /= norm;
        }
    }
}

std::vector<size_t> find_peaks(const std::vector<float>& signal, float threshold, size_t min_distance) {
    std::vector<size_t> peaks;
    
    for (size_t i = min_distance; i < signal.size() - min_distance; i++) {
        if (signal[i] > threshold) {
            bool is_peak = true;
            
            // Check if it's a local maximum
            for (size_t j = i - min_distance; j <= i + min_distance; j++) {
                if (j != i && signal[j] >= signal[i]) {
                    is_peak = false;
                    break;
                }
            }
            
            if (is_peak) {
                peaks.push_back(i);
            }
        }
    }
    
    return peaks;
}

} // namespace Math

// Time formatting utilities
namespace Time {

std::string format_time(float seconds) {
    int hours = static_cast<int>(seconds) / 3600;
    int minutes = (static_cast<int>(seconds) % 3600) / 60;
    float secs = std::fmod(seconds, 60.0f);
    
    std::ostringstream oss;
    oss << std::setfill('0') << std::setw(2) << hours << ":"
        << std::setfill('0') << std::setw(2) << minutes << ":"
        << std::setfill('0') << std::setw(6) << std::fixed << std::setprecision(3) << secs;
    
    return oss.str();
}

std::string get_current_timestamp() {
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()) % 1000;
    
    std::ostringstream oss;
    oss << std::put_time(std::gmtime(&time_t), "%Y-%m-%dT%H:%M:%S");
    oss << '.' << std::setfill('0') << std::setw(3) << ms.count() << 'Z';
    
    return oss.str();
}

} // namespace Time

} // namespace Utils