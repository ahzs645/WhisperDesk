import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { onRecordFinish } from '../lib/tauri-bindings'
import { toast } from 'sonner'

interface RecordingData {
  path: string
  name: string
}

interface AppContextType {
  lastRecording: RecordingData | null
  setLastRecording: (recording: RecordingData | null) => void
  requestTranscription: (audioPath: string) => void
  transcriptionRequest: string | null
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [lastRecording, setLastRecording] = useState<RecordingData | null>(null)
  const [transcriptionRequest, setTranscriptionRequest] = useState<string | null>(null)

  useEffect(() => {
    // Listen for recording completion globally
    const setupListener = async () => {
      await onRecordFinish((data) => {
        console.log('Recording finished:', data)
        setLastRecording(data)

        // Show notification with option to transcribe
        toast.success(
          `Recording saved: ${data.name}`,
          {
            description: 'Go to Transcription tab to transcribe',
            duration: 5000,
          }
        )
      })
    }

    setupListener().catch((err) => {
      console.error('Failed to setup record finish listener:', err)
    })
  }, [])

  const requestTranscription = (audioPath: string) => {
    setTranscriptionRequest(audioPath)
  }

  return (
    <AppContext.Provider
      value={{
        lastRecording,
        setLastRecording,
        requestTranscription,
        transcriptionRequest,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
