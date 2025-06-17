// src/renderer/whisperdesk-ui/src/components/transcription/EnhancedTranscriptionTab.jsx
// FIXED: Prevents auto-scrolling to Enhanced Screen Recording when switching tabs
import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAppState } from '@/App'
import { appInitializer } from '@/utils/AppInitializer'
import { ScreenRecorder } from '../screen-recorder'
import { FileUploadSection } from './FileUploadSection'
import { QuickRecordSection } from './QuickRecordSection'
import { TranscriptionSettings } from './TranscriptionSettings'
import { TranscriptionControls } from './TranscriptionControls'
import { TranscriptDisplay } from './TranscriptDisplay'

export function EnhancedTranscriptionTab() {
  const { appState, updateAppState, resetTranscription } = useAppState()
  
  // Local state for UI only
  const [providers, setProviders] = useState([])
  const [models, setModels] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false)
  const [diarizationAvailable, setDiarizationAvailable] = useState(false)
  
  // FIXED: Add scroll position preservation
  const scrollPositionRef = useRef(0)
  const containerRef = useRef(null)
  
  // Refs for cleanup and toast management
  const lastToastRef = useRef(null)
  const hasShownCompletionToast = useRef(false)

  // FIXED: Preserve scroll position when tab becomes active
  useEffect(() => {
    const preserveScrollPosition = () => {
      if (containerRef.current && scrollPositionRef.current > 0) {
        // Restore scroll position after a short delay to ensure content is rendered
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = scrollPositionRef.current
          }
        })
      }
    }

    // Save scroll position when component unmounts or tab changes
    const saveScrollPosition = () => {
      if (containerRef.current) {
        scrollPositionRef.current = containerRef.current.scrollTop
      }
    }

    // Set up intersection observer to detect when tab becomes visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            preserveScrollPosition()
          } else {
            saveScrollPosition()
          }
        })
      },
      { threshold: 0.1 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    // Save scroll position on page unload
    window.addEventListener('beforeunload', saveScrollPosition)

    return () => {
      saveScrollPosition()
      observer.disconnect()
      window.removeEventListener('beforeunload', saveScrollPosition)
    }
  }, [])

  // Check if diarization is available for the selected provider
  useEffect(() => {
    const checkDiarizationAvailability = () => {
      const selectedProvider = providers.find(p => p.id === appState.selectedProvider)
      setDiarizationAvailable(selectedProvider?.supportsDiarization || false)
    }
    
    checkDiarizationAvailability()
  }, [appState.selectedProvider, providers])

  // Load initial providers and models from AppInitializer on mount
  useEffect(() => {
    const loadInitialData = async () => {
      if (hasLoadedInitial) return
      
      console.log('🔄 Loading initial providers and models from app initialization...')
      
      try {
        // Check if AppInitializer has already loaded the data
        if (appInitializer.isReady()) {
          const services = appInitializer.services || {}
          
          // Load providers from services if available
          if (services.providers && services.providers.length > 0) {
            console.log('✅ Loading providers from AppInitializer:', services.providers.length)
            setProviders(services.providers)
          } else {
            // Fallback: Load providers directly from API
            console.log('🔄 Loading providers from API...')
            await refreshProviders(false) // Don't show toast for initial load
          }
          
          // Load models from services if available
          if (services.models && services.models.length > 0) {
            console.log('✅ Loading models from AppInitializer:', services.models.length)
            setModels(services.models)
          } else {
            // Fallback: Load models directly from API
            console.log('🔄 Loading models from API...')
            await refreshModels(false) // Don't show toast for initial load
          }
        } else {
          // AppInitializer not ready yet, try loading directly
          console.log('⏳ AppInitializer not ready, loading directly from APIs...')
          await Promise.all([
            refreshProviders(false),
            refreshModels(false)
          ])
        }
        
        setHasLoadedInitial(true)
        console.log('✅ Initial providers and models loaded successfully')
        
      } catch (error) {
        console.error('❌ Failed to load initial providers/models:', error)
        // Don't show error toast for initial load, just log it
      }
    }

    loadInitialData()
  }, [hasLoadedInitial])

  // Setup auto-transcription listener
  useEffect(() => {
    const cleanup = setupAutoTranscriptionListener()
    
    return () => {
      cleanup()
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
        
        // FIXED: Don't auto-scroll to recorder when auto-transcribing
        // Just start the transcription process
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
        enableTimestamps: true,
        // Add diarization options if available
        ...(diarizationAvailable && {
          enableSpeakerDiarization: appState.enableSpeakerDiarization,
          maxSpeakers: appState.maxSpeakers,
          speakerThreshold: appState.speakerThreshold
        })
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

  // Enhanced refresh functions with optional toast parameter
  const refreshProviders = async (showToast = true) => {
    try {
      setIsLoading(true)
      const availableProviders = await window.electronAPI.transcription.getProviders()
      setProviders(availableProviders)
      
      // Also update AppInitializer services cache
      if (appInitializer.services) {
        appInitializer.services.providers = availableProviders
      }
      
      if (showToast) {
        toast.success('🔄 Providers refreshed')
      }
      console.log('✅ Providers refreshed:', availableProviders.length)
    } catch (error) {
      console.error('Failed to refresh providers:', error)
      if (showToast) {
        toast.error('Failed to refresh providers: ' + error.message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const refreshModels = async (showToast = true) => {
    try {
      setIsLoading(true)
      const installedModels = await window.electronAPI.model.getInstalled()
      setModels(installedModels)
      
      // Also update AppInitializer services cache
      if (appInitializer.services) {
        appInitializer.services.models = installedModels
      }
      
      if (showToast) {
        toast.success('🔄 Models refreshed')
      }
      console.log('✅ Models refreshed:', installedModels.length)
    } catch (error) {
      console.error('Failed to refresh models:', error)
      if (showToast) {
        toast.error('Failed to refresh models: ' + error.message)
      }
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

  // Manual refresh that always shows toast
  const handleManualRefreshProviders = () => refreshProviders(true)
  const handleManualRefreshModels = () => refreshModels(true)

  // FIXED: Updated QuickRecordSection to not auto-scroll
  const handleQuickRecordClick = () => {
    // Instead of auto-scrolling, just show a gentle hint
    toast.info('📹 See enhanced recording options below', {
      action: {
        label: 'Scroll to Recorder',
        onClick: () => {
          document.getElementById('enhanced-recorder')?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          })
        }
      }
    })
  }

  return (
    <div 
      ref={containerRef}
      className="space-y-6 h-full overflow-y-auto"
      style={{ scrollBehavior: 'smooth' }}
    >
      {/* Enhanced Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* File Upload with Glass Effect */}
        <FileUploadSection
          selectedFile={appState.selectedFile}
          onFileChange={(fileInfo) => updateAppState({ selectedFile: fileInfo })}
        />

        {/* Enhanced Recording - FIXED: No auto-scroll */}
        <QuickRecordSection onQuickRecordClick={handleQuickRecordClick} />
      </div>

      {/* Enhanced Transcription Settings */}
      <TranscriptionSettings
        providers={providers}
        models={models}
        selectedProvider={appState.selectedProvider}
        selectedModel={appState.selectedModel}
        onProviderChange={(value) => updateAppState({ selectedProvider: value })}
        onModelChange={(value) => updateAppState({ selectedModel: value })}
        onRefreshProviders={handleManualRefreshProviders}
        onRefreshModels={handleManualRefreshModels}
        isLoading={isLoading}
        diarizationAvailable={diarizationAvailable}
        settings={{
          enableSpeakerDiarization: appState.enableSpeakerDiarization,
          maxSpeakers: appState.maxSpeakers,
          speakerThreshold: appState.speakerThreshold
        }}
        updateSetting={(key, value) => updateAppState({ [key]: value })}
      />

      {/* Enhanced Transcription Controls */}
      <TranscriptionControls
        selectedFile={appState.selectedFile}
        selectedProvider={appState.selectedProvider}
        selectedModel={appState.selectedModel}
        isTranscribing={appState.isTranscribing}
        progress={appState.progress}
        progressMessage={appState.progressMessage}
        activeTranscriptionId={appState.activeTranscriptionId}
        lastTranscriptionResult={appState.lastTranscriptionResult}
        onStartTranscription={handleStartTranscription}
        onStopTranscription={handleStopTranscription}
        onCopyText={handleCopyText}
        onExport={handleExport}
        onNewTranscription={handleNewTranscription}
      />

      {/* Enhanced Transcript Display */}
      <TranscriptDisplay 
        transcriptionResult={appState.lastTranscriptionResult}
        isTranscribing={appState.isTranscribing}
        progress={appState.progress}
        progressMessage={appState.progressMessage}
        onCopy={handleCopyText}
      />

      {/* Enhanced Screen Recorder - FIXED: Scroll position preserved */}
      <div id="enhanced-recorder">
        <ScreenRecorder />
      </div>
    </div>
  )
}