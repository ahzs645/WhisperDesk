import React, { useState, useEffect } from 'react'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Textarea } from '@repo/ui/components/textarea'
import { Progress } from '@repo/ui/components/progress'
import { Mic, FileAudio, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
  const [transcription, setTranscription] = useState('')
  const [progress, setProgress] = useState(0)
  const [segments, setSegments] = useState<TranscriptionSegment[]>([])
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)

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

  // Update transcription text from segments
  useEffect(() => {
    if (segments.length > 0) {
      const text = segments.map(s => s.text).join(' ')
      setTranscription(text)
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
    setTranscription('')
    toast.info('Starting transcription...')

    try {
      const result = await transcribe({
        audio_path: audioPath,
        language: 'en',
        word_timestamps: true,
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
    if (!transcription) {
      toast.error('No transcription to save')
      return
    }

    try {
      const savedPath = await saveTranscription(transcription, 'transcription.txt')
      if (savedPath) {
        toast.success('Transcription saved!')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save transcription')
    }
  }

  const handleExport = async () => {
    if (!transcription) {
      toast.error('No transcription to export')
      return
    }

    try {
      // Export as JSON with segments
      const exportData = {
        text: transcription,
        segments: segments,
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

      {/* Transcription Result */}
      <Card>
        <CardHeader>
          <CardTitle>Transcription</CardTitle>
          <CardDescription>
            {transcription ? 'Edit or export your transcription' : 'Your transcription will appear here'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder="Start a transcription to see results here..."
            className="min-h-[300px] font-mono text-sm"
          />

          {transcription && (
            <div className="flex gap-2">
              <Button onClick={handleSave}>
                Save
              </Button>
              <Button variant="outline" onClick={handleExport}>
                Export as JSON
              </Button>
              <Button variant="outline" onClick={() => {
                setTranscription('')
                setSegments([])
                setSelectedFilePath(null)
              }}>
                Clear
              </Button>
            </div>
          )}

          {isTranscribing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Transcribing... {segments.length} segments processed</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
