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
import { Upload, FileAudio, Mic, Square, Play, Pause, Copy, Download, AlertCircle } from 'lucide-react'
import { useAppState } from '@/App'
import { toast } from 'sonner'

export function TranscriptionTabElectron() {
  const { appState, updateAppState, resetTranscription } = useAppState()
  
  // Local state for UI only
  const [providers, setProviders] = useState([])
  const [models, setModels] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  
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
    
    // Progress handler - NO TOASTS, just state updates
    if (window.electronAPI.transcription.onProgress) {
      progressCleanupRef.current = window.electronAPI.transcription.onProgress((data) => {
        console.log('Progress received:', data.progress + '%')
        
        // Update state but NO toast notifications for progress
        updateAppState({
          progress: data.progress || 0,
          progressMessage: data.message || data.stage || 'Processing...'
        })
        
        // Only show ONE toast when starting - never update it during progress
        if (data.progress === 0 && data.stage === 'starting') {
          // Dismiss any previous toast
          if (lastToastRef.current) {
            toast.dismiss(lastToastRef.current)
          }
          
          lastToastRef.current = toast.loading('🎵 Transcribing audio...', {
            duration: Infinity // Keep showing until completion
          })
          hasShownCompletionToast.current = false
        }
        
        // DO NOT update the toast during progress - this was causing spam!
        // The progress bar in the UI will show the progress instead
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

  return (
    <div className="space-y-6">
      {/* File Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>File Selection</span>
            {appState.selectedFile && (
              <Badge variant="secondary">File Ready</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Select an audio or video file to transcribe using native Whisper
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {appState.selectedFile ? (
              <div className="space-y-2">
                <FileAudio className="w-12 h-12 mx-auto text-primary" />
                <div className="space-y-1">
                  <p className="font-medium">{appState.selectedFile.name}</p>
                  {appState.selectedFile.size > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {(appState.selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </div>
                <div className="flex gap-2 justify-center">
                  <Button onClick={handleFileSelect} variant="outline" size="sm">
                    Change File
                  </Button>
                  <Button onClick={handleNewTranscription} variant="outline" size="sm">
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                <div className="space-y-2">
                  <p className="text-lg font-medium">Drop your audio file here</p>
                  <p className="text-sm text-muted-foreground">
                    Or click to browse files
                  </p>
                </div>
                <Button onClick={handleFileSelect}>
                  Select Audio File
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Transcription Settings</CardTitle>
          <CardDescription>
            Configure the transcription provider and model
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={appState.selectedProvider}
                onValueChange={(value) => updateAppState({ selectedProvider: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name} {provider.isAvailable ? '' : '(Unavailable)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
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
                      {model.name || model.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {models.length === 0 && (
            <div className="flex items-center space-x-2 text-amber-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">
                No models installed. Please download a model from the Models tab.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcription Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Transcription</span>
            <div className="flex items-center space-x-2">
              {appState.isTranscribing && (
                <Badge variant="secondary" className="animate-pulse">
                  Processing...
                </Badge>
              )}
              {appState.transcription && !appState.isTranscribing && (
                <Badge variant="secondary">
                  Complete ✅
                </Badge>
              )}
            </div>
          </CardTitle>
          <CardDescription>
            Process your audio file with the selected provider and model
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {appState.isTranscribing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{appState.progressMessage}</span>
                <span>{Math.round(appState.progress)}%</span>
              </div>
              <Progress value={appState.progress} className="w-full" />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleStartTranscription}
              disabled={!appState.selectedFile || appState.isTranscribing || models.length === 0 || isLoading}
              className="flex-1"
            >
              {appState.isTranscribing ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Transcription
                </>
              )}
            </Button>

            {appState.transcription && (
              <>
                <Button onClick={handleCopyText} variant="outline">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <Button onClick={handleExport} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {appState.transcription && (
        <Card>
          <CardHeader>
            <CardTitle>Transcription Result</CardTitle>
            <CardDescription>
              {appState.lastTranscriptionResult?.segments?.length 
                ? `${appState.lastTranscriptionResult.segments.length} segments found`
                : 'Raw transcription text'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                value={appState.transcription}
                onChange={(e) => updateAppState({ transcription: e.target.value })}
                placeholder="Transcription will appear here..."
                className="min-h-[200px] font-mono text-sm"
              />
              
              {appState.lastTranscriptionResult?.metadata && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Provider: {appState.lastTranscriptionResult.metadata.provider}</div>
                  {appState.lastTranscriptionResult.metadata.duration && (
                    <div>Duration: {appState.lastTranscriptionResult.metadata.duration.toFixed(2)}s</div>
                  )}
                  <div>Character count: {appState.transcription.length}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}