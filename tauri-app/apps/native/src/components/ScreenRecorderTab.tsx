import React, { useState } from 'react'
import { Button } from '@repo/ui/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Video, Square, Pause, Play } from 'lucide-react'
import { toast } from 'sonner'
import { invoke } from '@repo/ui/lib/mock-tauri-api'

export function ScreenRecorderTab() {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    const mStr = String(mins).padStart(2, '0')
    const sStr = String(secs).padStart(2, '0')
    return mStr + ':' + sStr
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Screen Recorder
          </CardTitle>
          <CardDescription>Record your screen with audio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            {isRecording && (
              <div className="text-6xl font-mono font-bold text-primary">
                {formatDuration(duration)}
              </div>
            )}
            <div className="flex items-center gap-4">
              {!isRecording ? (
                <Button size="lg" onClick={() => { setIsRecording(true); toast.success('Recording started') }}>
                  <Video className="h-5 w-5 mr-2" />
                  Start Recording
                </Button>
              ) : (
                <Button size="lg" variant="destructive" onClick={() => { setIsRecording(false); setDuration(0); toast.success('Recording stopped') }}>
                  <Square className="h-5 w-5 mr-2" />
                  Stop
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
