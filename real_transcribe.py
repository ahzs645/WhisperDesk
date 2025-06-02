#!/usr/bin/env python3

import whisper
import sys
import os
import json
from pathlib import Path

def transcribe_audio(audio_path, model_name="tiny"):
    """
    Transcribe audio file using Whisper
    """
    try:
        print(f"Loading Whisper model: {model_name}")
        model = whisper.load_model(model_name)
        
        print(f"Transcribing audio file: {audio_path}")
        result = model.transcribe(audio_path)
        
        return {
            "success": True,
            "text": result["text"].strip(),
            "language": result.get("language", "unknown"),
            "segments": result.get("segments", []),
            "model": model_name
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    # Use the uploaded test.mp3 file
    audio_file = "/home/ubuntu/upload/test.mp3"
    
    if not os.path.exists(audio_file):
        print(f"Error: Audio file not found: {audio_file}")
        sys.exit(1)
    
    print(f"Starting transcription of {audio_file}")
    result = transcribe_audio(audio_file, "tiny")
    
    if result["success"]:
        print("\n" + "="*50)
        print("TRANSCRIPTION RESULT")
        print("="*50)
        print(f"Model: {result['model']}")
        print(f"Language: {result['language']}")
        print(f"Text: {result['text']}")
        print("="*50)
        
        # Save result to file
        output_file = "/home/ubuntu/WhisperDesk/transcription_result.json"
        with open(output_file, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"Result saved to: {output_file}")
        
    else:
        print(f"Transcription failed: {result['error']}")
        sys.exit(1)

