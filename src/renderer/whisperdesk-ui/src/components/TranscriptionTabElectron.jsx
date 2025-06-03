// src/renderer/whisperdesk-ui/src/components/TranscriptionTab-Electron.jsx - NO TOAST SPAM VERSION
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Upload, FileAudio, Mic, Square, Play, Pause, Copy, Download, AlertCircle, Circle, FileUp, Video } from 'lucide-react'
import { useAppState } from '@/App'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'

export function TranscriptionTabElectron() {
  const { appState, updateAppState, resetTranscription } = useAppState()
  
  // Local state for UI only
  const [providers, setProviders] = useState([])
  const [models, setModels] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [includeMicrophone, setIncludeMicrophone] = useState(true)
  const [includeSystemAudio, setIncludeSystemAudio] = useState(true)
  
  // Refs for cleanup and toast management
  const progressCleanupRef = useRef(null)
  const completeCleanupRef = useRef(null)
  const errorCleanupRef = useRef(null)
  const lastToastRef = useRef(null)
  const hasShownCompletionToast = useRef(false)

  // Initialize
  useEffect(() => {
    initializeElectronAPIs()
    return () => {
      // Cleanup event handlers
      if (progressCleanupRef.current) progressCleanupRef.current()
      if (completeCleanupRef.current) completeCleanupRef.current()
      if (errorCleanupRef.current) errorCleanupRef.current()
      
      // Dismiss any active toasts
      if (lastToastRef.current) {
        toast.dismiss(lastToastRef.current)
      }
    }
  }, [])

  const initializeElectronAPIs = async () => {
    if (!window.electronAPI) {
      console.error('Electron API not available')
      toast.error('Electron API not available')
      return
    }

    try {
      // Set up event handlers
      setupEventHandlers()
      
      // Get providers
      const availableProviders = await window.electronAPI.transcription.getProviders()
      setProviders(availableProviders)
      console.log('Available providers:', availableProviders)

      // Get installed models
      const installedModels = await window.electronAPI.model.getInstalled()
      setModels(installedModels)
      console.log('Installed models:', installedModels)

      // Set defaults if not already set
      if (!appState.selectedProvider && availableProviders.length > 0) {
        const nativeProvider = availableProviders.find(p => p.name === 'Native Whisper')
        updateAppState({ 
          selectedProvider: nativeProvider ? 'whisper-native' : availableProviders[0].id 
        })
      }

      if (!appState.selectedModel && installedModels.length > 0) {
        updateAppState({ selectedModel: installedModels[0].id })
      }

    } catch (error) {
      console.error('Failed to initialize Electron APIs:', error)
      toast.error('Failed to initialize: ' + error.message)
    }
  }

  const setupEventHandlers = () => {
    console.log('Setting up event handlers...')
    
    // Progress handler with enhanced debugging
    if (window.electronAPI.transcription.onProgress) {
      progressCleanupRef.current = window.electronAPI.transcription.onProgress((data) => {
        console.log('🎯 FRONTEND Progress received:', data)
        console.log('🎯 Progress value:', data.progress)
        console.log('🎯 Current appState.progress before update:', appState.progress)
        
        // Update state
        updateAppState({
          progress: data.progress || 0,
          progressMessage: data.message || data.stage || 'Processing...'
        })
        
        console.log('🎯 Progress state updated')
        
        // Only show ONE toast when starting
        if (data.progress === 0 && data.stage === 'starting') {
          if (lastToastRef.current) {
            toast.dismiss(lastToastRef.current)
          }
          
          lastToastRef.current = toast.loading('🎵 Transcribing audio...', {
            duration: Infinity
          })
          hasShownCompletionToast.current = false
        }
      })
      console.log('✅ Progress handler set up')
    } else {
      console.warn('❌ Progress handler not available')
    }

    // Completion handler - ONE SUCCESS TOAST
    if (window.electronAPI.transcription.onComplete) {
      completeCleanupRef.current = window.electronAPI.transcription.onComplete((data) => {
        console.log('Completion received:', data)
        
        // Dismiss loading toast
        if (lastToastRef.current) {
          toast.dismiss(lastToastRef.current)
          lastToastRef.current = null
        }
        
        if (data.result) {
          updateAppState({
            transcription: data.result.text || '',
            lastTranscriptionResult: data.result,
            isTranscribing: false,
            progress: 100,
            progressMessage: 'Complete!'
          })
          
          // Show ONE success toast only
          if (!hasShownCompletionToast.current) {
            toast.success(`✅ Transcription completed! ${data.result.segments?.length || 0} segments found.`, {
              duration: 4000 // Show for 4 seconds
            })
            hasShownCompletionToast.current = true
          }
        } else {
          updateAppState({
            isTranscribing: false,
            progress: 100,
            progressMessage: 'Completed with no result'
          })
          
          if (!hasShownCompletionToast.current) {
            toast.warning('Transcription completed but no result received')
            hasShownCompletionToast.current = true
          }
        }
      })
      console.log('✅ Completion handler set up')
    } else {
      console.warn('❌ Completion handler not available')
    }

    // Error handler - ONE ERROR TOAST
    if (window.electronAPI.transcription.onError) {
      errorCleanupRef.current = window.electronAPI.transcription.onError((data) => {
        console.error('Transcription error:', data)
        
        // Dismiss loading toast
        if (lastToastRef.current) {
          toast.dismiss(lastToastRef.current)
          lastToastRef.current = null
        }
        
        updateAppState({
          isTranscribing: false,
          progress: 0,
          progressMessage: 'Error occurred'
        })
        
        toast.error('❌ Transcription failed: ' + (data.error || 'Unknown error'))
        hasShownCompletionToast.current = true // Prevent further toasts
      })
      console.log('✅ Error handler set up')
    } else {
      console.warn('❌ Error handler not available')
    }
  }

  const handleFileSelect = async () => {
    if (!window.electronAPI?.file?.showOpenDialog) {
      toast.error('File API not available')
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

      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]
        
        // Create a file-like object for state storage
        const fileInfo = {
          path: filePath,
          name: filePath.split('/').pop() || filePath.split('\\').pop(),
          size: 0 // We don't have size info from Electron dialog
        }
        
        updateAppState({ selectedFile: fileInfo })
        toast.success(`📁 File selected: ${fileInfo.name}`)
      }
    } catch (error) {
      console.error('File selection failed:', error)
      toast.error('Failed to select file: ' + error.message)
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const file = files[0]
    const fileInfo = {
      path: file.path,
      name: file.name,
      size: file.size
    }

    updateAppState({ selectedFile: fileInfo })
    toast.success(`📁 File selected: ${file.name}`)
  }

  const handleStartTranscription = async () => {
    if (!appState.selectedFile) {
      toast.error('Please select an audio file first')
      return
    }

    if (!window.electronAPI?.transcription?.processFile) {
      toast.error('Transcription API not available')
      return
    }

    try {
      setIsLoading(true)
      
      // Reset transcription state but keep file
      updateAppState({
        transcription: '',
        isTranscribing: true,
        progress: 0,
        progressMessage: 'Starting transcription...',
        lastTranscriptionResult: null
      })
      
      // Reset completion toast flag
      hasShownCompletionToast.current = false

      const options = {
        provider: appState.selectedProvider,
        model: appState.selectedModel,
        language: 'auto',
        enableTimestamps: true
      }

      console.log('Starting transcription with options:', options)
      console.log('File path:', appState.selectedFile.path)

      // Process the file - this should trigger the event handlers we set up
      await window.electronAPI.transcription.processFile(appState.selectedFile.path, options)
      
      // Note: The completion will be handled by the event handler

    } catch (error) {
      console.error('Transcription failed:', error)
      
      // Dismiss any loading toast
      if (lastToastRef.current) {
        toast.dismiss(lastToastRef.current)
        lastToastRef.current = null
      }
      
      updateAppState({
        isTranscribing: false,
        progress: 0,
        progressMessage: 'Failed'
      })
      
      toast.error('Transcription failed: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyText = () => {
    if (!appState.transcription) {
      toast.error('No text to copy')
      return
    }

    if (window.electronAPI?.export?.copy) {
      window.electronAPI.export.copy(appState.transcription)
        .then(() => toast.success('📋 Text copied to clipboard'))
        .catch(err => toast.error('Copy failed: ' + err.message))
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(appState.transcription)
        .then(() => toast.success('📋 Text copied to clipboard'))
        .catch(err => toast.error('Copy failed: ' + err.message))
    } else {
      toast.error('Copy not supported')
    }
  }

  const handleExport = async () => {
    if (!appState.lastTranscriptionResult) {
      toast.error('No transcription to export')
      return
    }

    if (!window.electronAPI?.file?.showSaveDialog || !window.electronAPI?.export?.text) {
      toast.error('Export API not available')
      return
    }

    try {
      const result = await window.electronAPI.file.showSaveDialog({
        defaultPath: `transcription-${Date.now()}.txt`,
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'Subtitle Files', extensions: ['srt'] }
        ]
      })

      if (!result.canceled && result.filePath) {
        const format = result.filePath.split('.').pop()
        
        await window.electronAPI.export.text(appState.lastTranscriptionResult, format)
        toast.success('💾 Transcription exported successfully')
      }
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Export failed: ' + error.message)
    }
  }

  const handleNewTranscription = () => {
    // Dismiss any active toasts
    if (lastToastRef.current) {
      toast.dismiss(lastToastRef.current)
      lastToastRef.current = null
    }
    
    resetTranscription()
    hasShownCompletionToast.current = false
    toast.success('🆕 Ready for new transcription')
  }

  const handleStartRecording = async () => {
    if (!window.electronAPI?.screenRecorder?.startRecording) {
      toast.error('Screen recording API not available')
      return
    }

    try {
      const settings = {
        includeMicrophone: appState.recordingSettings?.includeMicrophone ?? true,
        includeSystemAudio: appState.recordingSettings?.includeSystemAudio ?? true
      }

      await window.electronAPI.screenRecorder.startRecording(settings)
      updateAppState({ isRecording: true })
      toast.success('🎥 Screen recording started')
    } catch (error) {
      console.error('Failed to start recording:', error)
      toast.error('Failed to start recording: ' + error.message)
    }
  }

  const handleStopRecording = async () => {
    if (!window.electronAPI?.screenRecorder?.stopRecording) {
      toast.error('Screen recording API not available')
      return
    }

    try {
      const result = await window.electronAPI.screenRecorder.stopRecording()
      updateAppState({ 
        isRecording: false,
        selectedFile: {
          path: result.filePath,
          name: result.filePath.split('/').pop() || result.filePath.split('\\').pop(),
          size: 0
        }
      })
      toast.success('🎥 Screen recording saved')
    } catch (error) {
      console.error('Failed to stop recording:', error)
      toast.error('Failed to stop recording: ' + error.message)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  return (
    <div className="space-y-6">
      {/* Unified Input Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileUp className="w-5 h-5" />
              <span>File Upload</span>
            </CardTitle>
            <CardDescription>
              Upload an audio or video file for transcription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleFileSelect}
            >
              <div className="space-y-2">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  Drag and drop your file here, or click to browse
                </div>
                {appState.selectedFile && (
                  <div className="mt-2 text-sm">
                    Selected: {appState.selectedFile.name}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Screen Recording */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Video className="w-5 h-5" />
              <span>Screen Recording</span>
            </CardTitle>
            <CardDescription>
              Record your screen with audio for transcription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                  <span className="text-sm font-medium">
                    {isRecording ? 'Recording...' : 'Ready to record'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="microphone"
                    checked={includeMicrophone}
                    onCheckedChange={setIncludeMicrophone}
                  />
                  <Label htmlFor="microphone">Include Microphone</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="system-audio"
                    checked={includeSystemAudio}
                    onCheckedChange={setIncludeSystemAudio}
                  />
                  <Label htmlFor="system-audio">Include System Audio</Label>
                </div>
              </div>

              <Button
                className={`w-full ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'}`}
                onClick={isRecording ? handleStopRecording : handleStartRecording}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Circle className="w-4 h-4 mr-2" />
                    Start Recording
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transcription Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Transcription Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                id="provider"
                value={appState.selectedProvider}
                onValueChange={(value) => updateAppState({ selectedProvider: value })}
              >
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
            <div className="grid gap-2">
              <Label htmlFor="model">Model</Label>
              <Select
                id="model"
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
          <CardTitle>Transcription</CardTitle>
          <CardDescription>
            Process your audio file with the selected provider and model
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Bar */}
            {appState.isTranscribing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{appState.progressMessage}</span>
                  <span>{Math.round(appState.progress)}%</span>
                </div>
                <Progress value={appState.progress} />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              {appState.transcription && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyText}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Text
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </>
              )}
              <Button
                onClick={handleStartTranscription}
                disabled={!appState.selectedFile || appState.isTranscribing}
              >
                {appState.isTranscribing ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Transcription
                  </>
                )}
              </Button>
            </div>

            {/* Transcription Result */}
            {appState.transcription && (
              <div className="mt-4">
                <Label>Result</Label>
                <Textarea
                  value={appState.transcription}
                  readOnly
                  className="mt-2 h-[200px]"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}