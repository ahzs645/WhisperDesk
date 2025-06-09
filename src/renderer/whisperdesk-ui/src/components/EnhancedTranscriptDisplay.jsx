// src/renderer/whisperdesk-ui/src/components/EnhancedTranscriptionDisplay.jsx
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Upload, 
  FileAudio, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Copy, 
  Download, 
  AlertCircle, 
  FileUp, 
  Video, 
  User, 
  Clock,
  RefreshCw,
  Settings,
  Zap
} from 'lucide-react'
import { useAppState } from '@/App'
import { toast } from 'sonner'
import { EnhancedScreenRecorder } from './EnhancedScreenRecorder'

// Enhanced Transcript Display Component (same as before but with improvements)
function EnhancedTranscriptDisplay({ 
  transcriptionResult, 
  isTranscribing = false, 
  progress = 0,
  progressMessage = '',
  onCopy,
  onExport,
  className = "" 
}) {
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollAreaRef = useRef(null)
  const bottomRef = useRef(null)

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll && bottomRef.current && transcriptionResult?.segments?.length > 0) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [transcriptionResult?.segments?.length, autoScroll])

  // Speaker color mapping for consistent colors per speaker
  const getSpeakerColor = (speakerId) => {
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
      'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
      'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
      'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
      'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800',
      'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800'
    ]
    
    if (!speakerId) return colors[0]
    
    // Generate consistent color based on speaker ID
    const hash = speakerId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    
    return colors[Math.abs(hash) % colors.length]
  }

  // Format timestamp
  const formatTime = (seconds) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get speaker initials for avatar
  const getSpeakerInitials = (speakerId, speakerLabel) => {
    if (speakerLabel) {
      return speakerLabel.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase()
    }
    if (!speakerId) return 'U'
    if (speakerId.includes('Speaker') || speakerId.includes('speaker')) {
      const num = speakerId.match(/\d+/)
      return num ? `S${num[0]}` : 'S'
    }
    return speakerId.substring(0, 2).toUpperCase()
  }

  // Get speaker display name
  const getSpeakerName = (speakerId, speakerLabel) => {
    if (speakerLabel) return speakerLabel
    if (!speakerId) return 'Unknown Speaker'
    if (speakerId.includes('Speaker') || speakerId.includes('speaker')) {
      const num = speakerId.match(/\d+/)
      return num ? `Speaker ${num[0]}` : 'Speaker'
    }
    return speakerId
  }

  const handleCopyAll = () => {
    if (!transcriptionResult?.text && !transcriptionResult?.segments) {
      toast.error('No text to copy')
      return
    }
    
    const textToCopy = transcriptionResult.text || 
      transcriptionResult.segments?.map(s => s.text).join(' ') || ''
    
    if (onCopy) {
      onCopy(textToCopy)
    }
  }

  const segments = transcriptionResult?.segments || []
  const hasContent = segments.length > 0 || transcriptionResult?.text

  return (
    <Card className={`h-[600px] flex flex-col ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Live Transcript
              {isTranscribing && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 animate-pulse">
                  <Mic className="w-3 h-3 mr-1" />
                  Transcribing
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {segments.length > 0 
                ? `${segments.length} segments • ${transcriptionResult?.metadata?.duration ? formatTime(transcriptionResult.metadata.duration) : 'Processing...'}`
                : isTranscribing 
                  ? 'Waiting for transcription...'
                  : 'Ready to transcribe'
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setAutoScroll(!autoScroll)}
              className={autoScroll ? 'bg-primary/10' : ''}
            >
              Auto-scroll
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCopyAll}
              disabled={!hasContent}
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy All
            </Button>
            {onExport && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onExport}
                disabled={!hasContent}
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            )}
          </div>
        </div>
        
        {isTranscribing && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{progressMessage || 'Processing...'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea ref={scrollAreaRef} className="h-full px-6">
          {segments.length === 0 && !transcriptionResult?.text ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Waiting for transcript...</p>
                {isTranscribing && <p className="text-sm mt-1">Processing audio...</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {/* Show segments if available, otherwise show plain text */}
              {segments.length > 0 ? (
                segments.map((segment, index) => (
                  <TranscriptSegment 
                    key={segment.id || index}
                    segment={segment}
                    speakerColor={getSpeakerColor(segment.speakerId || segment.speaker)}
                    speakerInitials={getSpeakerInitials(segment.speakerId || segment.speaker, segment.speakerLabel)}
                    speakerName={getSpeakerName(segment.speakerId || segment.speaker, segment.speakerLabel)}
                    formatTime={formatTime}
                    isLast={index === segments.length - 1}
                    isTranscribing={isTranscribing}
                  />
                ))
              ) : transcriptionResult?.text ? (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm leading-relaxed">{transcriptionResult.text}</p>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Individual transcript segment component (same as before)
function TranscriptSegment({ 
  segment, 
  speakerColor, 
  speakerInitials,
  speakerName,
  formatTime, 
  isLast, 
  isTranscribing 
}) {
  const [isPlaying, setIsPlaying] = useState(false)

  const handlePlaySegment = () => {
    setIsPlaying(!isPlaying)
    toast.info('Audio playback coming soon!')
  }

  return (
    <div className={`group relative ${isLast && isTranscribing ? 'animate-pulse' : ''}`}>
      <div className="flex gap-3">
        {/* Speaker Avatar */}
        <div className="flex-shrink-0">
          <Avatar className="w-8 h-8">
            <AvatarFallback className={`text-xs font-medium ${speakerColor}`}>
              {speakerInitials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={`text-xs ${speakerColor}`}>
              {speakerName}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatTime(segment.start)}
              {segment.end && segment.end !== segment.start && (
                <> → {formatTime(segment.end)}</>
              )}
            </span>
            {segment.confidence && (
              <span className="text-xs text-muted-foreground">
                {Math.round(segment.confidence * 100)}%
              </span>
            )}
            
            {/* Play button (appears on hover) */}
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
              onClick={handlePlaySegment}
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </Button>
          </div>

          {/* Text */}
          <div className="text-sm leading-relaxed text-foreground">
            {segment.text}
          </div>

          {/* Duration indicator */}
          {segment.end && segment.start && (
            <div className="text-xs text-muted-foreground mt-1">
              Duration: {formatTime(segment.end - segment.start)}
            </div>
          )}
        </div>
      </div>
      
      {/* Separator (except for last item) */}
      {!isLast && <Separator className="mt-4" />}
    </div>
  )
}

export function EnhancedTranscriptionTab() {
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
  const startCleanupRef = useRef(null)
  const cancelledCleanupRef = useRef(null)
  const modelUpdateCleanupRef = useRef(null)
  const modelDeleteCleanupRef = useRef(null)
  const lastToastRef = useRef(null)
  const hasShownCompletionToast = useRef(false)

  // Setup auto-transcription listener
  useEffect(() => {
    const cleanup = setupAutoTranscriptionListener()
    return () => {
      cleanup()
      // Cleanup event handlers
      if (progressCleanupRef.current) progressCleanupRef.current()
      if (completeCleanupRef.current) completeCleanupRef.current()
      if (errorCleanupRef.current) errorCleanupRef.current()
      if (startCleanupRef.current) startCleanupRef.current()
      if (cancelledCleanupRef.current) cancelledCleanupRef.current()
      if (modelUpdateCleanupRef.current) modelUpdateCleanupRef.current()
      if (modelDeleteCleanupRef.current) modelDeleteCleanupRef.current()
      
      // Dismiss any active toasts
      if (lastToastRef.current) {
        toast.dismiss(lastToastRef.current)
      }
    }
  }, [])

  // Auto-transcription listener for recordings
  const setupAutoTranscriptionListener = () => {
    const handleAutoTranscribe = (event) => {
      console.log('🤖 Auto-transcription triggered:', event.detail)
      
      if (event.detail?.file) {
        // Set the file and start transcription
        updateAppState({ selectedFile: event.detail.file })
        
        // Wait a moment for state to update, then start transcription
        setTimeout(() => {
          handleStartTranscription(true) // Pass flag to indicate auto-transcription
        }, 500)
      }
    }

    window.addEventListener('autoTranscribe', handleAutoTranscribe)
    
    return () => {
      window.removeEventListener('autoTranscribe', handleAutoTranscribe)
    }
  }

  const setupEventHandlers = () => {
    console.log('Setting up enhanced event handlers...')
    
    // Progress handler
    if (window.electronAPI.transcription.onProgress) {
      progressCleanupRef.current = window.electronAPI.transcription.onProgress((data) => {
        console.log('🎯 Enhanced progress received:', data)
        
        updateAppState({
          progress: data.progress || 0,
          progressMessage: data.message || data.stage || 'Processing...'
        })
        
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
    }

    // Completion handler
    if (window.electronAPI.transcription.onComplete) {
      completeCleanupRef.current = window.electronAPI.transcription.onComplete((data) => {
        console.log('Enhanced completion received:', data)
        
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
          
          // Show success toast with enhanced info
          if (!hasShownCompletionToast.current) {
            const segmentCount = data.result.segments?.length || 0
            const duration = data.result.metadata?.duration
            
            let message = `✅ Transcription completed!`
            if (segmentCount > 0) message += ` ${segmentCount} segments found.`
            if (duration) message += ` Duration: ${Math.floor(duration)}s.`
            
            toast.success(message, { duration: 4000 })
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
    }

    // Error handler
    if (window.electronAPI.transcription.onError) {
      errorCleanupRef.current = window.electronAPI.transcription.onError((data) => {
        console.error('Enhanced transcription error:', data)
        
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
        hasShownCompletionToast.current = true
      })
    }

    if (window.electronAPI.transcription.onStart) {
      startCleanupRef.current = window.electronAPI.transcription.onStart((data) => {
        updateAppState({ activeTranscriptionId: data.transcriptionId, isTranscribing: true })
      })
    }

    if (window.electronAPI.transcription.onCancelled) {
      cancelledCleanupRef.current = window.electronAPI.transcription.onCancelled(() => {
        updateAppState({ isTranscribing: false, progress: 0, progressMessage: 'Cancelled', activeTranscriptionId: null })
        if (lastToastRef.current) {
          toast.dismiss(lastToastRef.current)
          lastToastRef.current = null
        }
        toast.warning('⏹️ Transcription cancelled')
      })
    }

    // Model event handlers
    if (window.electronAPI.model.onDownloadComplete) {
      modelUpdateCleanupRef.current = window.electronAPI.model.onDownloadComplete(async () => {
        const installedModels = await window.electronAPI.model.getInstalled()
        setModels(installedModels)
        if (!installedModels.some(m => m.id === appState.selectedModel)) {
          updateAppState({ selectedModel: installedModels[0]?.id || null })
        }
      })
    }

    if (window.electronAPI.model.onModelDeleted) {
      modelDeleteCleanupRef.current = window.electronAPI.model.onModelDeleted(async () => {
        const installedModels = await window.electronAPI.model.getInstalled()
        setModels(installedModels)
        if (!installedModels.some(m => m.id === appState.selectedModel)) {
          updateAppState({ selectedModel: installedModels[0]?.id || null })
        }
      })
    }
  }

  const refreshProviders = async () => {
    try {
      setIsLoading(true)
      const availableProviders = await window.electronAPI.transcription.getProviders()
      setProviders(availableProviders)
      toast.success('🔄 Providers refreshed')
    } catch (error) {
      console.error('Failed to refresh providers:', error)
      toast.error('Failed to refresh providers: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshModels = async () => {
    try {
      setIsLoading(true)
      const installedModels = await window.electronAPI.model.getInstalled()
      setModels(installedModels)
      toast.success('🔄 Models refreshed')
    } catch (error) {
      console.error('Failed to refresh models:', error)
      toast.error('Failed to refresh models: ' + error.message)
    } finally {
      setIsLoading(false)
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
        
        const fileInfo = {
          path: filePath,
          name: filePath.split('/').pop() || filePath.split('\\').pop(),
          size: 0
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

  const handleStartTranscription = async (isAutoTranscribe = false) => {
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
        progressMessage: isAutoTranscribe ? 'Auto-transcribing...' : 'Starting transcription...',
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

      console.log('Starting enhanced transcription with options:', options)
      console.log('File path:', appState.selectedFile.path)

      if (isAutoTranscribe) {
        toast.info('🤖 Auto-transcription started from recording')
      }

      // Process the file
      await window.electronAPI.transcription.processFile(appState.selectedFile.path, options)

    } catch (error) {
      console.error('Enhanced transcription failed:', error)
      
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

  const handleStopTranscription = async () => {
    if (!appState.activeTranscriptionId) return
    if (!window.electronAPI?.transcription?.stop) {
      toast.error('Stop API not available')
      return
    }

    try {
      await window.electronAPI.transcription.stop(appState.activeTranscriptionId)
      updateAppState({ isTranscribing: false, progress: 0, progressMessage: 'Cancelled', activeTranscriptionId: null })
      if (lastToastRef.current) {
        toast.dismiss(lastToastRef.current)
        lastToastRef.current = null
      }
      toast.warning('⏹️ Transcription cancelled')
    } catch (error) {
      console.error('Failed to stop transcription:', error)
      toast.error('Failed to stop transcription: ' + error.message)
    }
  }

  const handleCopyText = (text) => {
    const textToCopy = text || appState.transcription
    if (!textToCopy) {
      toast.error('No text to copy')
      return
    }

    if (window.electronAPI?.export?.copy) {
      window.electronAPI.export.copy(textToCopy)
        .then(() => toast.success('📋 Text copied to clipboard'))
        .catch(err => toast.error('Copy failed: ' + err.message))
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy)
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
          { name: 'Subtitle Files', extensions: ['srt'] },
          { name: 'WebVTT Files', extensions: ['vtt'] }
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

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileUp className="w-5 h-5" />
              <span>File Upload</span>
              {appState.selectedFile && (
                <Badge variant="secondary" className="ml-2">
                  <FileAudio className="w-3 h-3 mr-1" />
                  Selected
                </Badge>
              )}
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
                <div className="text-xs text-muted-foreground">
                  Supports: MP3, WAV, MP4, AVI, MOV, and more
                </div>
                {appState.selectedFile && (
                  <div className="mt-2 p-2 bg-muted rounded text-sm">
                    <strong>Selected:</strong> {appState.selectedFile.name}
                    {appState.selectedFile.size > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Size: {(appState.selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Recording */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Video className="w-5 h-5" />
              <span>Quick Record</span>
              <Badge variant="outline" className="ml-2">
                <Zap className="w-3 h-3 mr-1" />
                Auto-transcribe
              </Badge>
            </CardTitle>
            <CardDescription>
              Record screen with audio and automatically transcribe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-3">
              Recording will automatically start transcription when complete.
              For advanced recording options, see the dedicated recording section below.
            </div>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => {
                // Scroll to enhanced recorder or switch to recording tab
                document.getElementById('enhanced-recorder')?.scrollIntoView({ behavior: 'smooth' })
                toast.info('📹 See enhanced recording options below')
              }}
            >
              <Video className="w-4 h-4 mr-2" />
              Use Enhanced Recorder
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Transcription Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Transcription Settings</span>
              </CardTitle>
              <CardDescription>
                Configure provider, model, and transcription options
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshProviders}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Providers
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshModels}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Models
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Transcription Provider</Label>
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
                    <SelectItem 
                      key={provider.id} 
                      value={provider.id}
                      disabled={!provider.isAvailable}
                    >
                      <div className="flex items-center space-x-2">
                        <span>{provider.name}</span>
                        {!provider.isAvailable && (
                          <Badge variant="destructive" className="text-xs">
                            Unavailable
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {providers.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  No providers available. Check your configuration.
                </div>
              )}
            </div>
            
            <div className="space-y-2">
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
                      <div className="flex items-center space-x-2">
                        <span>{model.name}</span>
                        {model.size && (
                          <Badge variant="outline" className="text-xs">
                            {typeof model.size === 'number' 
                              ? `${(model.size / 1024 / 1024).toFixed(0)}MB`
                              : model.size
                            }
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {models.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  No models installed. Visit the Models tab to download.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Transcription Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transcription Control</CardTitle>
              <CardDescription>
                Process your audio file with enhanced progress tracking
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {appState.lastTranscriptionResult && (
                <Badge variant="outline" className="text-green-600">
                  <Download className="w-3 h-3 mr-1" />
                  Ready to export
                </Badge>
              )}
              {appState.isTranscribing && (
                <Badge variant="default" className="animate-pulse">
                  <Mic className="w-3 h-3 mr-1" />
                  Processing...
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {appState.isTranscribing && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleStopTranscription}
                    disabled={!appState.activeTranscriptionId}
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                )}
                <Button
                  onClick={() => handleStartTranscription(false)}
                  disabled={!appState.selectedFile || appState.isTranscribing || !appState.selectedProvider || !appState.selectedModel}
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
              
              <div className="flex items-center space-x-2">
                {appState.lastTranscriptionResult && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyText()}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
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
                  variant="outline"
                  size="sm"
                  onClick={handleNewTranscription}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  New
                </Button>
              </div>
            </div>

            {/* Progress Info */}
            {appState.isTranscribing && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span>{appState.progressMessage || 'Processing...'}</span>
                  <span>{Math.round(appState.progress || 0)}%</span>
                </div>
                <Progress value={appState.progress || 0} className="h-2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Transcript Display */}
      <EnhancedTranscriptDisplay 
        transcriptionResult={appState.lastTranscriptionResult}
        isTranscribing={appState.isTranscribing}
        progress={appState.progress}
        progressMessage={appState.progressMessage}
        onCopy={handleCopyText}
        onExport={handleExport}
      />

      {/* Enhanced Screen Recorder */}
      <div id="enhanced-recorder">
        <EnhancedScreenRecorder />
      </div>
    </div>
  )
}