import whisper
import os
import json
from datetime import datetime

def transcribe_audio(audio_path, model_size="tiny"):
    """
    Transcribe audio file using OpenAI Whisper
    """
    print(f"Loading Whisper {model_size} model...")
    model = whisper.load_model(model_size)
    
    print(f"Transcribing audio file: {audio_path}")
    result = model.transcribe(audio_path)
    
    return result

def save_transcript(result, output_dir):
    """
    Save transcript in multiple formats
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Save as plain text
    txt_path = os.path.join(output_dir, "transcript.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(result["text"])
    
    # Save as JSON with detailed information
    json_path = os.path.join(output_dir, "transcript.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    # Save as SRT subtitle format
    srt_path = os.path.join(output_dir, "transcript.srt")
    with open(srt_path, "w", encoding="utf-8") as f:
        for i, segment in enumerate(result["segments"], 1):
            start_time = format_time(segment["start"])
            end_time = format_time(segment["end"])
            text = segment["text"].strip()
            f.write(f"{i}\n{start_time} --> {end_time}\n{text}\n\n")
    
    return txt_path, json_path, srt_path

def format_time(seconds):
    """
    Format time in SRT format (HH:MM:SS,mmm)
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millisecs = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millisecs:03d}"

def main():
    audio_file = "/home/ubuntu/upload/test.mp3"
    output_dir = "/home/ubuntu/WhisperDesk/transcripts"
    
    if not os.path.exists(audio_file):
        print(f"Error: Audio file not found at {audio_file}")
        return
    
    print("=== WhisperDesk Audio Transcription ===")
    print(f"Audio file: {audio_file}")
    print(f"Output directory: {output_dir}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    try:
        # Transcribe the audio
        result = transcribe_audio(audio_file, "tiny")
        
        # Save transcripts
        txt_path, json_path, srt_path = save_transcript(result, output_dir)
        
        print("\n=== Transcription Results ===")
        print(f"Detected language: {result['language']}")
        print(f"Text: {result['text']}")
        print()
        
        print("=== Files Generated ===")
        print(f"Plain text: {txt_path}")
        print(f"JSON format: {json_path}")
        print(f"SRT subtitles: {srt_path}")
        print()
        
        print("=== Segment Details ===")
        for i, segment in enumerate(result["segments"], 1):
            start = format_time(segment["start"])
            end = format_time(segment["end"])
            text = segment["text"].strip()
            print(f"Segment {i}: [{start} - {end}] {text}")
        
        print("\n✅ Transcription completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during transcription: {str(e)}")
        raise

if __name__ == "__main__":
    main()

