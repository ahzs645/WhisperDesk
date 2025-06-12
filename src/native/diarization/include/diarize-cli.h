// src/native/diarization/include/diarize-cli.h
#pragma once

#include <string>
#include <vector>
#include <memory>

struct DiarizeOptions {
    std::string audio_path;
    std::string segment_model_path;
    std::string embedding_model_path;
    std::string output_format = "json";
    int max_speakers = 10;
    float threshold = 0.5f;
    int sample_rate = 16000;
    bool verbose = false;
    std::string output_file;
};

struct AudioSegment {
    std::vector<float> samples;
    float start_time;
    float end_time;
    int speaker_id;
    float confidence;
    std::string text; // For integration with transcription
};

// Forward declarations
class SpeakerSegmenter;
class SpeakerEmbedder;

class DiarizationEngine {
private:
    std::unique_ptr<SpeakerSegmenter> segmenter_;
    std::unique_ptr<SpeakerEmbedder> embedder_;
    std::vector<std::vector<float>> speaker_embeddings_;
    std::vector<int> speaker_counts_;
    bool verbose_;

public:
    explicit DiarizationEngine(bool verbose = false);
    ~DiarizationEngine();
    
    bool initialize(const std::string& segment_model_path, const std::string& embedding_model_path);
    std::vector<AudioSegment> process_audio(const std::vector<float>& audio, const DiarizeOptions& options);

private:
    std::vector<float> detect_speaker_changes(const std::vector<float>& audio, const DiarizeOptions& options);
    std::vector<AudioSegment> create_segments(const std::vector<float>& audio, 
                                            const std::vector<float>& change_points,
                                            const DiarizeOptions& options);
    std::vector<AudioSegment> assign_speakers(std::vector<AudioSegment>& segments, const DiarizeOptions& options);
    int find_or_create_speaker(const std::vector<float>& embedding, float threshold, int max_speakers);
    float calculate_confidence(const std::vector<float>& embedding, int speaker_id);
    float cosine_similarity(const std::vector<float>& a, const std::vector<float>& b);
};

// Utility functions
DiarizeOptions parse_arguments(int argc, char* argv[]);
void output_results(const std::vector<AudioSegment>& segments, const DiarizeOptions& options);