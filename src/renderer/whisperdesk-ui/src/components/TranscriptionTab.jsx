import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { 
  Mic, 
  MicOff,
  Upload, 
  File,
  Play,
  Pause,
  Square,
  Download,
  Copy,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileAudio,
  FileVideo,
  X,
  ExternalLink
} from 'lucide-react'

export function TranscriptionTab() {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [selectedFile, setSelectedFile] = useState(null)
  const [transcriptionResult, setTranscriptionResult] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionProgress, setTranscriptionProgress] = useState(0)
  const [error, setError] = useState(null)
  const [audioDevices, setAudioDevices] = useState([])
  const [selectedDevice, setSelectedDevice] = useState('')
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [installedModels, setInstalledModels] = useState([])
  const [hasModels, setHasModels] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(true)
  
  const fileInputRef = useRef(null)
  const recordingIntervalRef = useRef(null)
  const dropZoneRef = useRef(null)

  useEffect(() => {
    loadInstalledModels()
    loadAudioDevices()
    loadProviders()
    setupEventListeners()
    
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      // Cleanup event listeners
      if (window.electronAPI?.transcription?.onProgress) {
        window.electronAPI.transcription.onProgress(() => {})
      }
      if (window.electronAPI?.transcription?.onResult) {
        window.electronAPI.transcription.onResult(() => {})
      }
      if (window.electronAPI?.transcription?.onComplete) {
        window.electronAPI.transcription.onComplete(() => {})
      }
      if (window.electronAPI?.transcription?.onError) {
        window.electronAPI.transcription.onError(() => {})
      }
    }
  }, [])

  const setupEventListeners = () => {
    if (!window.electronAPI?.transcription) return

    // Transcription progress
    window.electronAPI.transcription.onProgress((event, data) => {
      setTranscriptionProgress(data.progress || 0)
    })

    // Transcription result (partial)
    window.electronAPI.transcription.onResult((event, data) => {
      if (data.text) {
        setTranscriptionResult(prev => prev + data.text + ' ')
      }
    })

    // Transcription complete
    window.electronAPI.transcription.onComplete((event, data) => {
      setIsTranscribing(false)
      setTranscriptionProgress(100)
      if (data.text) {
        setTranscriptionResult(data.text)
      }
    })

    // Transcription error
    window.electronAPI.transcription.onError((event, data) => {
      setIsTranscribing(false)
      setError(`Transcription failed: ${data.error}`)
    })

    // Listen for model changes
    if (window.electronAPI?.model) {
      window.electronAPI.model.onDownloadComplete(() => {
        loadInstalledModels()
      })
      
      window.electronAPI.model.onModelDeleted(() => {
        loadInstalledModels()
      })
    }
  }

  const loadInstalledModels = async () => {
    try {
      setModelsLoading(true)
      
      if (!window.electronAPI?.model?.getInstalled) {
        setHasModels(false)
        return
      }
      
      const models = await window.electronAPI.model.getInstalled()
      setInstalledModels(models)
      setHasModels(models.length > 0)
    } catch (err) {
      console.error('Error loading installed models:', err)
      setHasModels(false)
    } finally {
      setModelsLoading(false)
    }
  }

  const loadAudioDevices = async () => {
    try {
      if (!window.electronAPI?.audio?.getDevices) return
      
      const devices = await window.electronAPI.audio.getDevices()
      setAudioDevices(devices)
      
      // Select default device
      const defaultDevice = devices.find(d => d.isDefault) || devices[0]
      if (defaultDevice) {
        setSelectedDevice(defaultDevice.id)
      }
    } catch (err) {
      console.error('Error loading audio devices:', err)
    }
  }

  const loadProviders = async () => {
    try {
      if (!window.electronAPI?.transcription?.getProviders) return
      
      const availableProviders = await window.electronAPI.transcription.getProviders()
      setProviders(availableProviders)
      
      // Select default provider
      if (availableProviders.length > 0) {
        setSelectedProvider(availableProviders[0].id)
      }
    } catch (err) {
      console.error('Error loading providers:', err)
    }
  }

  const handleStartRecording = async () => {
    try {
      setError(null)
      
      if (!selectedDevice) {
        setError('Please select an audio device')
        return
      }
      
      await window.electronAPI.audio.startRecording(selectedDevice)
      setIsRecording(true)
      setIsPaused(false)
      setRecordingTime(0)
      setTranscriptionResult('')
      
      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
      
      // Start real-time transcription if provider supports it
      if (selectedProvider) {
        await window.electronAPI.transcription.start({
          provider: selectedProvider,
          realTime: true
        })
      }
    } catch (err) {
      setError(`Failed to start recording: ${err.message}`)
    }
  }

  const handleStopRecording = async () => {
    try {
      await window.electronAPI.audio.stopRecording()
      await window.electronAPI.transcription.stop()
      
      setIsRecording(false)
      setIsPaused(false)
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    } catch (err) {
      setError(`Failed to stop recording: ${err.message}`)
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleFileUpload = async (file) => {
    try {
      setError(null)
      
      // Check if models are available
      if (!hasModels) {
        setError('Please download a transcription model first before uploading files.')
        return
      }
      
      // Validate file type
      const allowedTypes = [
        'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/m4a', 'audio/aac', 'audio/ogg',
        'video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm'
      ]
      
      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|flac|m4a|aac|ogg|mp4|avi|mov|mkv|webm)$/i)) {
        setError('Unsupported file format. Please select an audio or video file.')
        return
      }
      
      setSelectedFile(file)
      setTranscriptionResult('')
      
      // Start transcription
      if (selectedProvider) {
        setIsTranscribing(true)
        setTranscriptionProgress(0)
        
        await window.electronAPI.transcription.processFile(file.path, {
          provider: selectedProvider
        })
      }
    } catch (err) {
      setError(`Failed to process file: ${err.message}`)
      setIsTranscribing(false)
    }
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    if (hasModels && !modelsLoading) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (event) => {
    event.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragOver(false)
    
    // Check if models are available
    if (!hasModels) {
      setError('Please download a transcription model first before uploading files.')
      return
    }
    
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleClearFile = () => {
    setSelectedFile(null)
    setTranscriptionResult('')
    setTranscriptionProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCopyResult = async () => {
    try {
      await window.electronAPI.export.copy(transcriptionResult)
    } catch (err) {
      setError('Failed to copy to clipboard')
    }
  }

  const handleExportResult = async () => {
    try {
      await window.electronAPI.export.text(transcriptionResult, 'txt')
    } catch (err) {
      setError('Failed to export transcription')
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getFileIcon = (file) => {
    if (!file) return File
    
    const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|avi|mov|mkv|webm)$/i)
    return isVideo ? FileVideo : FileAudio
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Model Availability Check */}
      {!modelsLoading && !hasModels && (
        <Alert>
          <Download className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>You need to download a model first before you can transcribe audio.</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  // This would typically navigate to the Models tab
                  // For now, we'll just show a message
                  setError('Please go to the Models tab to download a transcription model.')
                }}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Go to Models
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {modelsLoading && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>Checking for installed models...</AlertDescription>
        </Alert>
      )}

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Transcription Settings</CardTitle>
          <CardDescription>Configure your transcription preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Transcription Provider</label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Audio Device</label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  {audioDevices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{device.name} {device.isDefault && '(Default)'}</span>
                        {device.canRecordSystem && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            System Audio
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDevice && audioDevices.find(d => d.id === selectedDevice)?.canRecordSystem && (
                <p className="text-xs text-muted-foreground">
                  This device can record system audio including applications and media playback.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recording Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Live Recording</CardTitle>
          <CardDescription>Record audio directly from your microphone</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center space-x-4">
            {!isRecording ? (
              <Button 
                onClick={handleStartRecording} 
                size="lg"
                className="bg-red-500 hover:bg-red-600"
                disabled={!selectedProvider || !selectedDevice || !hasModels || modelsLoading}
              >
                <Mic className="w-5 h-5 mr-2" />
                Start Recording
              </Button>
            ) : (
              <div className="flex items-center space-x-2">
                <Button 
                  onClick={handleStopRecording} 
                  size="lg"
                  variant="outline"
                >
                  <Square className="w-5 h-5 mr-2" />
                  Stop Recording
                </Button>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {formatTime(recordingTime)}
                </Badge>
              </div>
            )}
          </div>
          
          {!hasModels && !modelsLoading && (
            <div className="text-center text-sm text-muted-foreground">
              Recording is disabled until you download a transcription model.
            </div>
          )}
          
          {isRecording && (
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 text-red-500">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Recording in progress...</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle>File Upload</CardTitle>
          <CardDescription>Upload audio or video files for transcription</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${!hasModels || modelsLoading 
                ? 'border-muted-foreground/10 bg-muted/20 cursor-not-allowed' 
                : isDragOver 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }
            `}
          >
            {selectedFile ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-2">
                  {React.createElement(getFileIcon(selectedFile), { className: "w-8 h-8 text-primary" })}
                  <span className="font-medium">{selectedFile.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFile}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                {isTranscribing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Transcribing...</span>
                    </div>
                    <Progress value={transcriptionProgress} className="w-full max-w-xs mx-auto" />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className={`w-12 h-12 mx-auto ${!hasModels || modelsLoading ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} />
                <div className="space-y-2">
                  <p className={`text-lg font-medium ${!hasModels || modelsLoading ? 'text-muted-foreground' : ''}`}>
                    {!hasModels && !modelsLoading ? 'Download a model first to upload files' : 'Drop files here or click to browse'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supports MP3, WAV, FLAC, M4A, AAC, OGG, MP4, AVI, MOV, MKV, WebM
                  </p>
                </div>
                <Button 
                  onClick={handleFileSelect} 
                  variant="outline"
                  disabled={!hasModels || modelsLoading}
                >
                  <File className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.mp4,.avi,.mov,.mkv,.webm"
            onChange={handleFileChange}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Transcription Result */}
      {transcriptionResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transcription Result</CardTitle>
                <CardDescription>Your transcribed text</CardDescription>
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleCopyResult} variant="outline" size="sm">
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
                <Button onClick={handleExportResult} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={transcriptionResult}
              onChange={(e) => setTranscriptionResult(e.target.value)}
              placeholder="Transcription will appear here..."
              className="min-h-[200px] resize-none"
              readOnly={isTranscribing}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

