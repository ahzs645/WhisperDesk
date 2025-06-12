// src/native/diarization/include/utils.h
#pragma once

#include <vector>
#include <string>
#include <map>

#ifdef _WIN32
#include <windows.h>

// Helper used by multiple translation units
static inline std::wstring string_to_wstring(const std::string& str) {
    if (str.empty()) return std::wstring();

    int size_needed = MultiByteToWideChar(CP_UTF8, 0, &str[0],
                                          static_cast<int>(str.size()),
                                          NULL, 0);
    std::wstring wstr(size_needed, 0);
    MultiByteToWideChar(CP_UTF8, 0, &str[0], static_cast<int>(str.size()),
                        &wstr[0], size_needed);
    return wstr;
}
#endif

// Forward declarations
struct AudioSegment;
struct DiarizeOptions;

namespace Utils {

/**
 * Audio I/O functions
 */
namespace Audio {
    /**
     * Load audio file and return samples as float vector
     * @param file_path Path to audio file
     * @param target_sample_rate Desired sample rate (will resample if needed)
     * @return Vector of audio samples normalized to [-1, 1]
     */
    std::vector<float> load_audio_file(const std::string& file_path, int target_sample_rate = 16000);
    
    /**
     * Simple audio loading for raw PCM files
     * @param file_path Path to raw PCM file
     * @return Vector of audio samples
     */
    std::vector<float> load_audio_simple(const std::string& file_path);
    
    /**
     * Normalize audio to [-1, 1] range
     * @param audio Audio samples to normalize (modified in-place)
     */
    void normalize_audio(std::vector<float>& audio);
    
    /**
     * Simple resampling (for production use proper resampler)
     * @param audio Input audio samples
     * @param source_rate Original sample rate
     * @param target_rate Target sample rate
     * @return Resampled audio
     */
    std::vector<float> simple_resample(const std::vector<float>& audio, 
                                      int source_rate, 
                                      int target_rate);
}

/**
 * JSON output formatting
 */
namespace Json {
    /**
     * Output diarization results as JSON
     * @param segments Diarization segments
     * @param options Diarization options used
     */
    void output_results(const std::vector<AudioSegment>& segments, const DiarizeOptions& options);
    
    /**
     * Generate speaker statistics
     * @param segments Diarization segments
     * @return Map of speaker_id -> statistics
     */
    std::map<int, std::map<std::string, float>> generate_speaker_stats(const std::vector<AudioSegment>& segments);
}

/**
 * Command line argument parsing
 */
namespace Args {
    /**
     * Parse command line arguments
     * @param argc Argument count
     * @param argv Argument values
     * @return Parsed options
     */
    DiarizeOptions parse_arguments(int argc, char* argv[]);
    
    /**
     * Print help message
     */
    void print_help();
    
    /**
     * Print version information
     */
    void print_version();
}

/**
 * File system utilities
 */
namespace FileSystem {
    /**
     * Check if file exists
     * @param file_path Path to check
     * @return true if file exists
     */
    bool file_exists(const std::string& file_path);
    
    /**
     * Get file size in bytes
     * @param file_path Path to file
     * @return File size, or -1 if error
     */
    long get_file_size(const std::string& file_path);
    
    /**
     * Get file extension
     * @param file_path Path to file
     * @return File extension (including dot)
     */
    std::string get_file_extension(const std::string& file_path);
}

/**
 * Math utilities
 */
namespace Math {
    /**
     * Calculate cosine similarity between two vectors
     * @param a First vector
     * @param b Second vector
     * @return Cosine similarity [-1, 1]
     */
    float cosine_similarity(const std::vector<float>& a, const std::vector<float>& b);
    
    /**
     * Normalize vector to unit length
     * @param vec Vector to normalize (modified in-place)
     */
    void normalize_vector(std::vector<float>& vec);
    
    /**
     * Find peaks in signal
     * @param signal Input signal
     * @param threshold Minimum peak height
     * @param min_distance Minimum distance between peaks
     * @return Indices of peaks
     */
    std::vector<size_t> find_peaks(const std::vector<float>& signal, 
                                   float threshold, 
                                   size_t min_distance = 1);
}

/**
 * Time formatting utilities
 */
namespace Time {
    /**
     * Format seconds as HH:MM:SS.mmm
     * @param seconds Time in seconds
     * @return Formatted time string
     */
    std::string format_time(float seconds);
    
    /**
     * Get current timestamp as ISO string
     * @return ISO timestamp string
     */
    std::string get_current_timestamp();
}

} // namespace Utils