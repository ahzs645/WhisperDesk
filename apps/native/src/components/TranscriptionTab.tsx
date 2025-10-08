import React, { useState, useEffect } from 'react'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Progress } from '@repo/ui/components/progress'
import { Mic, FileAudio, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { TranscriptDisplay } from '@repo/ui/components/transcription/TranscriptDisplay'
import {
  selectAudioFile,
  saveTranscription,
  transcribe,
  onTranscriptionProgress,
  onTranscriptionSegment,
  type TranscriptionSegment,
} from '../lib/tauri-bindings'

export function TranscriptionTab() {
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [segments, setSegments] = useState<TranscriptionSegment[]>([])
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [transcriptionResult, setTranscriptionResult] = useState<any>(null)

  useEffect(() => {
    // Setup transcription event listeners
    const setupListeners = async () => {
      await onTranscriptionProgress((prog) => {
        setProgress(prog)
      })

      await onTranscriptionSegment((segment) => {
        setSegments((prev) => [...prev, segment])
      })
    }

    setupListeners()

    // Listen for transcription requests from recording
    const handleTranscriptionRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{ path: string }>
      if (customEvent.detail?.path) {
        handleTranscribe(customEvent.detail.path)
      }
    }

    window.addEventListener('requestTranscription', handleTranscriptionRequest)

    // Check for pending transcription on mount
    const pendingPath = sessionStorage.getItem('pendingTranscriptionPath')
    if (pendingPath) {
      sessionStorage.removeItem('pendingTranscriptionPath')
      toast.info('Starting transcription of recorded audio...')
      handleTranscribe(pendingPath)
    }

    return () => {
      window.removeEventListener('requestTranscription', handleTranscriptionRequest)
    }
  }, [])

  // Update transcription result from segments
  useEffect(() => {
    if (segments.length > 0) {
      setTranscriptionResult({
        segments: segments.map((s, index) => ({
          ...s,
          id: `segment-${index}`,
          speakerId: s.speaker || null,
          speakerLabel: s.speaker ? `Speaker ${s.speaker}` : null,
          start_time: (s.start / 100).toFixed(2), // Convert centiseconds to seconds
          end_time: (s.stop / 100).toFixed(2),
        })),
        text: segments.map(s => s.text).join(' '),
        metadata: {
          duration: segments.length > 0 ? (segments[segments.length - 1].stop / 100) : 0,
        }
      })
    }
  }, [segments])

  const handleTranscribe = async (audioPath: string) => {
    if (!audioPath) {
      toast.error('No audio file selected')
      return
    }

    setIsTranscribing(true)
    setProgress(0)
    setSegments([])
    setTranscriptionResult(null)
    toast.info('Starting transcription...')

    try {
      // Load settings from localStorage
      const settingsStr = localStorage.getItem('whisperdesk_settings')
      const settings = settingsStr ? JSON.parse(settingsStr) : {}

      // Configure transcription based on settings
      const enableDiarization = settings.enableSpeakerDiarization ?? false
      const enableTimestamps = settings.enableTimestamps ?? true

      const result = await transcribe({
        audio_path: audioPath,
        language: settings.autoDetectLanguage ? undefined : 'en',
        // When diarization is enabled, disable word timestamps to get sentence-level segments
        word_timestamps: enableDiarization ? false : enableTimestamps,
        // When word timestamps are enabled without diarization, group words into sentences
        max_sentence_len: (!enableDiarization && enableTimestamps) ? 24 : undefined,
        enable_diarization: enableDiarization,
        max_speakers: settings.maxSpeakers ?? 10,
        diarization_threshold: 0.5,
      })

      setProgress(100)
      toast.success('Transcription complete!')
    } catch (error) {
      console.error('Transcription error:', error)
      toast.error('Transcription failed: ' + String(error))
    } finally {
      setIsTranscribing(false)
      setTimeout(() => setProgress(0), 2000)
    }
  }

  const handleFileSelect = async () => {
    try {
      const filePath = await selectAudioFile()
      if (filePath) {
        setSelectedFilePath(filePath)
        toast.success(`Selected: ${filePath.split('/').pop()}`)
        await handleTranscribe(filePath)
      }
    } catch (error) {
      console.error('File selection error:', error)
      toast.error('Failed to select file')
    }
  }

  const handleSave = async () => {
    if (!transcriptionResult?.text) {
      toast.error('No transcription to save')
      return
    }

    try {
      const savedPath = await saveTranscription(transcriptionResult.text, 'transcription.txt')
      if (savedPath) {
        toast.success('Transcription saved!')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save transcription')
    }
  }

  const handleExport = async () => {
    if (!transcriptionResult) {
      toast.error('No transcription to export')
      return
    }

    try {
      // Export as JSON with segments
      const exportData = {
        text: transcriptionResult.text,
        segments: transcriptionResult.segments,
        timestamp: new Date().toISOString(),
        audioFile: selectedFilePath,
      }

      const savedPath = await saveTranscription(
        JSON.stringify(exportData, null, 2),
        'transcription.json'
      )
      if (savedPath) {
        toast.success('Transcription exported!')
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export transcription')
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={handleFileSelect}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileAudio className="h-5 w-5" />
              Upload File
            </CardTitle>
            <CardDescription>
              Select an audio file to transcribe
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Record Audio
            </CardTitle>
            <CardDescription>
              Go to Screen Recorder tab to record
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import
            </CardTitle>
            <CardDescription>
              Import existing transcription
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Progress */}
      {isTranscribing && (
        <Card>
          <CardHeader>
            <CardTitle>Transcribing...</CardTitle>
            <CardDescription>Processing audio with Whisper</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground mt-2">{progress}% complete</p>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Transcript Display with Speaker Diarization */}
      <TranscriptDisplay
        transcriptionResult={transcriptionResult}
        isTranscribing={isTranscribing}
        progress={progress}
        progressMessage={isTranscribing ? `Processing... ${segments.length} segments` : ''}
        onCopy={() => {
          const textToCopy = transcriptionResult?.text || ''
          if (textToCopy) {
            navigator.clipboard.writeText(textToCopy)
            toast.success('📋 Text copied to clipboard')
          }
        }}
        onTranscriptionUpdate={(updatedResult) => {
          setTranscriptionResult(updatedResult)
        }}
      />
    </div>
  )
}
