import React, { useState, useEffect } from 'react'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Video, Square } from 'lucide-react'
import { toast } from 'sonner'
import { startRecord, stopRecord, getAudioDevices, onRecordFinish, type AudioDevice } from '../lib/tauri-bindings'

export function ScreenRecorderTab() {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([])
  const [selectedDevices, setSelectedDevices] = useState<AudioDevice[]>([])

  useEffect(() => {
    // Load audio devices
    getAudioDevices().then(devices => {
      setAudioDevices(devices)
      // Pre-select default devices
      setSelectedDevices(devices.filter(d => d.is_default))
    }).catch(err => {
      console.error('Failed to load audio devices:', err)
      toast.error('Failed to load audio devices')
    })

    // Listen for recording finish
    const unlistenPromise = onRecordFinish((data) => {
      toast.success(`Recording saved: ${data.name}`, {
        description: 'Click to transcribe this recording',
        duration: 10000,
        action: {
          label: 'Transcribe',
          onClick: () => {
            // Store the path for the TranscriptionTab to pick up
            sessionStorage.setItem('pendingTranscriptionPath', data.path)
            // Dispatch custom event
            window.dispatchEvent(new CustomEvent('requestTranscription', {
              detail: { path: data.path }
            }))
          }
        }
      })
      setIsRecording(false)
      setDuration(0)
    })

    unlistenPromise.catch(err => {
      console.error('Failed to setup record finish listener:', err)
    })

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(() => {})
    }
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isRecording) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRecording])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    const mStr = String(mins).padStart(2, '0')
    const sStr = String(secs).padStart(2, '0')
    return mStr + ':' + sStr
  }

  const handleStartRecording = async () => {
    try {
      if (selectedDevices.length === 0) {
        toast.error('Please select at least one audio device')
        return
      }
      await startRecord(selectedDevices, true)
      setIsRecording(true)
      setDuration(0)
      toast.success('Recording started')
    } catch (err) {
      console.error('Failed to start recording:', err)
      toast.error('Failed to start recording')
    }
  }

  const handleStopRecording = async () => {
    try {
      await stopRecord()
      toast.success('Recording stopped, processing...')
    } catch (err) {
      console.error('Failed to stop recording:', err)
      toast.error('Failed to stop recording')
    }
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
          {!isRecording && audioDevices.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Audio Devices</label>
              <div className="space-y-2">
                {audioDevices.map((device) => (
                  <label key={device.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDevices.some(d => d.id === device.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDevices([...selectedDevices, device])
                        } else {
                          setSelectedDevices(selectedDevices.filter(d => d.id !== device.id))
                        }
                      }}
                    />
                    <span className="text-sm">
                      {device.name} {device.is_default && '(Default)'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            {isRecording && (
              <div className="text-6xl font-mono font-bold text-primary">
                {formatDuration(duration)}
              </div>
            )}
            <div className="flex items-center gap-4">
              {!isRecording ? (
                <Button size="lg" onClick={handleStartRecording}>
                  <Video className="h-5 w-5 mr-2" />
                  Start Recording
                </Button>
              ) : (
                <Button size="lg" variant="destructive" onClick={handleStopRecording}>
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
