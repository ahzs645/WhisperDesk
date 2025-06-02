// src/renderer/whisperdesk-ui/src/components/TranscriptionTab-Electron.jsx - With persistent state
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Upload, Mic, Download, Copy, Play, Pause, FileAudio, X, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useAppState } from '@/App'

export function TranscriptionTabElectron() {
  // Use app-wide state instead of local state
  const { appState, updateAppState, resetTranscription } = useAppState()
  
  // Local state for UI-only things
  const [providers, setProviders] = useState([])
  const [models, setModels] = useState([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    // Check if we're in Electron
    const electronAvailable = typeof window !== 'undefined' && window.electronAPI
    setIsElectron(electronAvailable)
    updateAppState({ isElectron: electronAvailable })
    
    if (electronAvailable) {
      loadProviders()
      loadModels()
      setupEventListeners()
    }
  }, [])

  const setupEventListeners = () => {
    if (!window.electronAPI) return

    // Listen for transcription progress
    const unsubscribeProgress = window.electronAPI.transcription.onProgress((data) => {
      console.log('Progress update:', data)
      updateAppState({
        progress: data.progress || 0,
        progressMessage: data.message || `${data.stage}: ${data.progress}%`
      })
      toast.info(data.message || `${data.stage}: ${data.progress}%`)
    })

    // Listen for transcription completion
    const unsubscribeComplete = window.electronAPI.transcription.onComplete((data) => {
      console.log('Transcription complete:', data)
      updateAppState({
        isTranscribing: false,
        progress: 100,
        progressMessage: 'Completed!',
        transcription: data.result.text || 'Transcription completed but no text found',
        lastTranscriptionResult: data.result
      })
      toast.success('Transcription completed!')
    })

    // Listen for transcription errors
    const unsubscribeError = window.electronAPI.transcription.onError((data) => {
      console.error('Transcription error:', data)
      updateAppState({
        isTranscribing: false,
        progress: 0,
        progressMessage: ''
      })
      toast.error(`Transcription failed: ${data.error}`)
    })

    // Cleanup function
    return () => {
      unsubscribeProgress()
      unsubscribeComplete()
      unsubscribeError()
    }
  }

  const loadProviders = async () => {
    try {
      const providers = await window.electronAPI.transcription.getProviders()
      setProviders(providers)
      
      // Set default provider to first available
      const availableProvider = providers.find(p => p.isAvailable)
      if (availableProvider && !appState.selectedProvider) {
        updateAppState({ selectedProvider: availableProvider.id })
      }
    } catch (error) {
      console.error('Failed to load providers:', error)
      toast.error('Failed to load transcription providers')
    }
  }

  const loadModels = async () => {
    try {
      const installedModels = await window.electronAPI.model.getInstalled()
      setModels(installedModels)
      
      // Set default model
      if (installedModels.length > 0 && !appState.selectedModel) {
        updateAppState({ selectedModel: installedModels[0].id })
      }
    } catch (error) {
      console.error('Failed to load models:', error)
      toast.error('Failed to load models')
    }
  }

  // Drag and drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const droppedFile = files[0]
      
      // Check if it's an audio/video file
      const audioExtensions = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus']
      const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm']
      const validExtensions = [...audioExtensions, ...videoExtensions]
      
      const extension = droppedFile.name.split('.').pop().toLowerCase()
      if (validExtensions.includes(extension)) {
        updateAppState({
          selectedFile: {
            name: droppedFile.name,
            path: droppedFile.path, // Electron provides the full path
            size: droppedFile.size,
            type: droppedFile.type
          }
        })
        toast.success(`Selected: ${droppedFile.name}`)
      } else {
        toast.error('Please drop an audio or video file')
      }
    }
  }, [updateAppState])

  const handleFileSelect = async () => {
    if (!window.electronAPI) {
      toast.error('File selection only available in Electron app')
      return
    }

    try {
      const result = await window.electronAPI.file.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'] },
          { name: 'Video Files', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]
        updateAppState({
          selectedFile: {
            name: filePath.split('/').pop(),
            path: filePath
          }
        })
        toast.success(`Selected: ${filePath.split('/').pop()}`)
      }
    } catch (error) {
      console.error('File selection failed:', error)
      toast.error('Failed to select file')
    }
  }

  const handleTranscribe = async () => {
    if (!appState.selectedFile) {
      toast.error('Please select an audio file first')
      return
    }

    if (!window.electronAPI) {
      toast.error('Transcription only available in Electron app')
      return
    }

    updateAppState({
      isTranscribing: true,
      progress: 0,
      progressMessage: 'Starting transcription...',
      transcription: ''
    })

    try {
      const options = {
        provider: appState.selectedProvider,
        model: appState.selectedModel,
        language: 'auto',
        enableTimestamps: true
      }

      console.log('Starting transcription with options:', options)
      console.log('File path:', appState.selectedFile.path)

      await window.electronAPI.transcription.processFile(appState.selectedFile.path, options)
    } catch (error) {
      updateAppState({
        isTranscribing: false,
        progress: 0,
        progressMessage: ''
      })
      console.error('Transcription failed:', error)
      toast.error(`Transcription failed: ${error.message}`)
    }
  }

  const handleCopyText = async () => {
    if (!appState.transcription) {
      toast.error('No transcription to copy')
      return
    }

    try {
      if (window.electronAPI) {
        await window.electronAPI.export.copy(appState.transcription)
      } else {
        await navigator.clipboard.writeText(appState.transcription)
      }
      toast.success('Transcription copied to clipboard!')
    } catch (error) {
      console.error('Copy failed:', error)
      toast.error('Failed to copy transcription')
    }
  }

  const handleExport = async () => {
    if (!appState.transcription) {
      toast.error('No transcription to export')
      return
    }

    if (!window.electronAPI) {
      toast.error('Export only available in Electron app')
      return
    }

    try {
      const result = await window.electronAPI.file.showSaveDialog({
        defaultPath: 'transcription.txt',
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'SRT Subtitles', extensions: ['srt'] }
        ]
      })

      if (!result.canceled) {
        const extension = result.filePath.split('.').pop().toLowerCase()
        await window.electronAPI.export.text(
          { 
            text: appState.transcription, 
            segments: appState.lastTranscriptionResult?.segments || [] 
          }, 
          extension
        )
        toast.success('Transcription exported successfully!')
      }
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export transcription')
    }
  }

  const removeFile = () => {
    updateAppState({ selectedFile: null })
    resetTranscription()
  }

  const handleNewTranscription = () => {
    resetTranscription()
    toast.info('Ready for new transcription')
  }

  if (!isElectron) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Electron Required</CardTitle>
          <CardDescription>
            This component requires the Electron environment. Please use the web interface instead.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {(appState.selectedFile || appState.transcription) && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                {appState.selectedFile && (
                  <p className="text-sm">
                    <span className="font-medium">File:</span> {appState.selectedFile.name}
                  </p>
                )}
                {appState.transcription && (
                  <p className="text-sm">
                    <span className="font-medium">Result:</span> {appState.transcription.length} characters
                  </p>
                )}
              </div>
              <Button onClick={handleNewTranscription} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                New
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drag & Drop File Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileAudio className="w-5 h-5" />
            <span>Select Audio File</span>
          </CardTitle>
          <CardDescription>
            Drag & drop an audio file or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${isDragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
              }
            `}
            onClick={handleFileSelect}
          >
            {appState.selectedFile ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center space-x-2">
                  <FileAudio className="w-8 h-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{appState.selectedFile.name}</p>
                    {appState.selectedFile.size && (
                      <p className="text-sm text-muted-foreground">
                        {(appState.selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile()
                    }}
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Click to choose a different file or drag & drop to replace
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-lg font-medium">
                    Drop your audio file here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Or click to browse for files
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Supports: MP3, WAV, FLAC, M4A, AAC, OGG, MP4, AVI, MOV
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Provider and Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Transcription Settings</CardTitle>
          <CardDescription>
            Configure your transcription preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Provider</label>
              <Select 
                value={appState.selectedProvider} 
                onValueChange={(value) => updateAppState({ selectedProvider: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id} disabled={!provider.isAvailable}>
                      {provider.name} {!provider.isAvailable && '(Unavailable)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <Select 
                value={appState.selectedModel} 
                onValueChange={(value) => updateAppState({ selectedModel: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transcription Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mic className="w-5 h-5" />
            <span>Transcription</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Button 
              onClick={handleTranscribe} 
              disabled={!appState.selectedFile || appState.isTranscribing}
              className="flex items-center space-x-2"
            >
              {appState.isTranscribing ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span>{appState.isTranscribing ? 'Transcribing...' : 'Start Transcription'}</span>
            </Button>
            
            {appState.transcription && (
              <>
                <Button onClick={handleCopyText} variant="outline" size="sm">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <Button onClick={handleExport} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </>
            )}
          </div>

          {appState.isTranscribing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{appState.progressMessage || 'Processing...'}</span>
                <span>{appState.progress.toFixed(1)}%</span>
              </div>
              <Progress value={appState.progress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {appState.transcription && (
        <Card>
          <CardHeader>
            <CardTitle>Transcription Result</CardTitle>
            <CardDescription>
              {appState.selectedFile?.name && `Transcribed from: ${appState.selectedFile.name}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={appState.transcription}
              onChange={(e) => updateAppState({ transcription: e.target.value })}
              placeholder="Transcription will appear here..."
              className="min-h-[200px]"
            />
            
            {/* Results metadata */}
            {appState.lastTranscriptionResult?.metadata && (
              <div className="mt-4 p-3 bg-muted/50 rounded text-sm space-y-1">
                <div className="font-medium">Transcription Details:</div>
                <div>Segments: {appState.lastTranscriptionResult.metadata.segments_count || 0}</div>
                <div>Duration: {appState.lastTranscriptionResult.metadata.duration?.toFixed(1) || 0}s</div>
                <div>Provider: {appState.lastTranscriptionResult.metadata.provider}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}