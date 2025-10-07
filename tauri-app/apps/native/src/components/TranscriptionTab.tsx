import React, { useState } from 'react'
import { Button } from '@repo/ui/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Textarea } from '@repo/ui/components/ui/textarea'
import { Progress } from '@repo/ui/components/ui/progress'
import { Mic, FileAudio, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { invoke } from '@repo/ui/lib/mock-tauri-api'

export function TranscriptionTab() {
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [progress, setProgress] = useState(0)

  const handleTranscribe = async () => {
    setIsTranscribing(true)
    setProgress(0)
    toast.info('Starting transcription...')

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 300)

      const result = await invoke('start_transcription', {
        options: {
          model: 'tiny',
          language: 'en',
          task: 'transcribe'
        }
      })

      clearInterval(progressInterval)
      setProgress(100)

      setTranscription(result.text)
      toast.success('Transcription complete!')
    } catch (error) {
      toast.error('Transcription failed: ' + String(error))
    } finally {
      setIsTranscribing(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }

  const handleFileSelect = async () => {
    try {
      const filePath = await invoke('open_file')
      toast.success(`Selected file: ${filePath}`)
      await handleTranscribe()
    } catch (error) {
      toast.error('Failed to select file')
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

        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={handleTranscribe}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Record Audio
            </CardTitle>
            <CardDescription>
              Record from your microphone
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
              <Button onClick={() => toast.success('Saved!')}>
                Save
              </Button>
              <Button variant="outline" onClick={() => toast.success('Exported!')}>
                Export
              </Button>
              <Button variant="outline" onClick={() => setTranscription('')}>
                Clear
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
