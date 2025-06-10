// src/renderer/whisperdesk-ui/src/components/ModelMarketplace-WebCompatible.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Package, Download, Trash2, HardDrive, Gauge, Clock, Check, AlertCircle, Loader2, X, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

export function ModelMarketplace() {
  const [availableModels, setAvailableModels] = useState([])
  const [installedModels, setInstalledModels] = useState([])
  const [downloads, setDownloads] = useState(new Map()) // Track download progress
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  // FIXED: Track download requests to prevent duplicates
  const downloadingModels = useRef(new Set())
  const lastStateUpdate = useRef(Date.now())

  // Refs for cleanup
  const downloadProgressCleanup = useRef(null)
  const downloadCompleteCleanup = useRef(null)
  const downloadErrorCleanup = useRef(null)
  const downloadQueuedCleanup = useRef(null)
  const downloadCancelledCleanup = useRef(null)

  useEffect(() => {
    const electronAvailable = typeof window !== 'undefined' && window.electronAPI
    setIsElectron(electronAvailable)

    if (electronAvailable) {
      setupEventHandlers()
      loadModelsFromElectron()
    } else {
      setLoading(false)
      toast.warning('Model downloads only available in Electron app')
    }

    return () => {
      // Cleanup event handlers
      if (downloadProgressCleanup.current) downloadProgressCleanup.current()
      if (downloadCompleteCleanup.current) downloadCompleteCleanup.current()
      if (downloadErrorCleanup.current) downloadErrorCleanup.current()
      if (downloadQueuedCleanup.current) downloadQueuedCleanup.current()
      if (downloadCancelledCleanup.current) downloadCancelledCleanup.current()
    }
  }, [])

  const setupEventHandlers = () => {
    console.log('🔧 Setting up model download event handlers...')

    // FIXED: Progress handler with better state management
    if (window.electronAPI.model.onDownloadProgress) {
      downloadProgressCleanup.current = window.electronAPI.model.onDownloadProgress((data) => {
        console.log(`📊 Download progress ${data.modelId}: ${Math.round(data.progress)}%`)
        
        setDownloads(prev => {
          const next = new Map(prev)
          const existing = next.get(data.modelId) || {}
          
          next.set(data.modelId, {
            ...existing,
            progress: Math.round(data.progress), // Round to prevent too many updates
            status: 'downloading',
            downloadedBytes: data.downloadedBytes,
            totalBytes: data.totalBytes,
            speed: data.speed
          })
          
          return next
        })
      })
    }

    // FIXED: Completion handler with immediate state sync
    if (window.electronAPI.model.onDownloadComplete) {
      downloadCompleteCleanup.current = window.electronAPI.model.onDownloadComplete(async (data) => {
        console.log('✅ Download complete:', data)
        
        // FIXED: Remove from downloads and downloading set immediately
        setDownloads(prev => {
          const next = new Map(prev)
          next.delete(data.modelId)
          return next
        })
        
        downloadingModels.current.delete(data.modelId)
        
        // FIXED: Force immediate refresh of installed models
        console.log('🔄 Refreshing installed models after download completion...')
        await refreshInstalledModels()
        
        toast.success(`✅ ${data.installedModel?.name || data.modelId} downloaded successfully!`)
      })
    }

    // FIXED: Error handler
    if (window.electronAPI.model.onDownloadError) {
      downloadErrorCleanup.current = window.electronAPI.model.onDownloadError((data) => {
        console.error('❌ Download error:', data)
        
        setDownloads(prev => {
          const next = new Map(prev)
          next.delete(data.modelId)
          return next
        })
        
        downloadingModels.current.delete(data.modelId)
        
        toast.error(`❌ Failed to download model: ${data.error}`)
      })
    }

    // FIXED: Queue handler with immediate UI feedback
    if (window.electronAPI.model.onDownloadQueued) {
      downloadQueuedCleanup.current = window.electronAPI.model.onDownloadQueued((data) => {
        console.log('📥 Download queued:', data)
        
        setDownloads(prev => new Map(prev).set(data.modelId, {
          progress: 0,
          status: 'queued',
          downloadedBytes: 0,
          totalBytes: data.totalBytes || 0
        }))
      })
    }

    // FIXED: Cancellation handler
    if (window.electronAPI.model.onDownloadCancelled) {
      downloadCancelledCleanup.current = window.electronAPI.model.onDownloadCancelled((data) => {
        console.log('🚫 Download cancelled:', data)
        
        setDownloads(prev => {
          const next = new Map(prev)
          next.delete(data.modelId)
          return next
        })
        
        downloadingModels.current.delete(data.modelId)
        
        toast.info('📥 Download cancelled')
      })
    }
  }

  // FIXED: Separated refresh functions for better control
  const refreshInstalledModels = useCallback(async () => {
    try {
      console.log('🔄 Refreshing installed models...')
      const models = await window.electronAPI.model.getInstalled()
      console.log(`💾 Loaded ${models.length} installed models:`, models.map(m => m.id))
      setInstalledModels(models)
      lastStateUpdate.current = Date.now()
    } catch (error) {
      console.error('❌ Failed to refresh installed models:', error)
    }
  }, [])

  const refreshAvailableModels = useCallback(async () => {
    try {
      console.log('📦 Refreshing available models...')
      const models = await window.electronAPI.model.getAvailable()
      console.log(`📦 Loaded ${models.length} available models`)
      setAvailableModels(models)
    } catch (error) {
      console.error('❌ Failed to refresh available models:', error)
      setAvailableModels([])
    }
  }, [])

  // FIXED: Comprehensive model refresh
  const loadModelsFromElectron = useCallback(async () => {
    try {
      setLoading(true)
      console.log('🔄 Loading models from Electron...')
      
      await Promise.all([
        refreshAvailableModels(),
        refreshInstalledModels()
      ])
      
      console.log('✅ Models loaded successfully')
    } catch (error) {
      console.error('❌ Failed to load models:', error)
      toast.error('Failed to load models: ' + error.message)
    } finally {
      setLoading(false)
    }
  }, [refreshAvailableModels, refreshInstalledModels])

  // FIXED: Manual refresh with loading state
  const handleRefresh = useCallback(async () => {
    if (refreshing) return
    
    try {
      setRefreshing(true)
      await loadModelsFromElectron()
      toast.success('🔄 Models refreshed!')
    } catch (error) {
      toast.error('Failed to refresh: ' + error.message)
    } finally {
      setRefreshing(false)
    }
  }, [loadModelsFromElectron, refreshing])

  // FIXED: Enhanced download handler with duplicate prevention
  const handleDownloadModel = async (modelId) => {
    if (!isElectron) {
      toast.error('Model downloads only available in Electron app')
      return
    }

    // FIXED: Multiple layers of duplicate prevention
    
    // 1. Check if already in downloading set
    if (downloadingModels.current.has(modelId)) {
      console.log(`⚠️ Download already in progress for ${modelId}`)
      toast.warning('📥 Download already in progress')
      return
    }

    // 2. Check if already in downloads state
    if (downloads.has(modelId)) {
      console.log(`⚠️ Download state exists for ${modelId}`)
      toast.warning('📥 Model is being downloaded')
      return
    }

    // 3. Check if already installed (with recent state update)
    const isRecentlyInstalled = installedModels.some(model => model.id === modelId)
    if (isRecentlyInstalled) {
      console.log(`⚠️ Model ${modelId} is already installed`)
      toast.warning('📦 Model is already installed')
      return
    }

    // 4. Additional backend check for edge cases
    try {
      const modelInfo = await window.electronAPI.model.getInfo(modelId)
      if (modelInfo?.isInstalled) {
        console.log(`⚠️ Backend confirms ${modelId} is already installed`)
        toast.warning('📦 Model is already installed')
        await refreshInstalledModels() // Sync UI state
        return
      }
    } catch (error) {
      console.warn('Could not check model info:', error)
    }

    // FIXED: Mark as downloading immediately
    downloadingModels.current.add(modelId)

    try {
      console.log(`🚀 Starting download for model: ${modelId}`)
      
      // Add to downloads state immediately for UI feedback
      setDownloads(prev => new Map(prev).set(modelId, {
        progress: 0,
        status: 'starting',
        downloadedBytes: 0,
        totalBytes: 0
      }))

      const result = await window.electronAPI.model.download(modelId)
      console.log(`✅ Download request successful for ${modelId}:`, result)
      
    } catch (error) {
      console.error(`❌ Failed to start download for ${modelId}:`, error)
      
      // FIXED: Clean up state on error
      downloadingModels.current.delete(modelId)
      setDownloads(prev => {
        const next = new Map(prev)
        next.delete(modelId)
        return next
      })
      
      // FIXED: Better error handling
      if (error.message?.includes('already installed')) {
        toast.warning('📦 Model is already installed')
        await refreshInstalledModels() // Sync UI state
      } else if (error.message?.includes('not found')) {
        toast.error('❌ Model not found in catalog')
      } else if (error.message?.includes('already being downloaded')) {
        toast.warning('📥 Model is already being downloaded')
      } else {
        toast.error(`❌ Failed to start download: ${error.message}`)
      }
    }
  }

  const handleCancelDownload = async (modelId) => {
    if (!isElectron) return
    
    try {
      console.log(`🚫 Cancelling download for ${modelId}`)
      await window.electronAPI.model.cancelDownload(modelId)
      
      // Clean up local state
      downloadingModels.current.delete(modelId)
      setDownloads(prev => {
        const updated = new Map(prev)
        updated.delete(modelId)
        return updated
      })
      
    } catch (error) {
      console.error('Failed to cancel download:', error)
      toast.error('Failed to cancel download: ' + error.message)
    }
  }

  const handleDeleteModel = async (modelId) => {
    if (!isElectron) {
      toast.error('Model deletion only available in Electron app')
      return
    }

    try {
      console.log('🗑️ Deleting model:', modelId)
      await window.electronAPI.model.delete(modelId)
      
      // Immediate state update
      setInstalledModels(prev => prev.filter(m => m.id !== modelId))
      
      toast.success('🗑️ Model deleted successfully')
    } catch (error) {
      console.error('Failed to delete model:', error)
      toast.error('Failed to delete model: ' + error.message)
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond) => {
    if (!bytesPerSecond) return ''
    return `${formatBytes(bytesPerSecond)}/s`
  }

  // FIXED: Enhanced model status detection
  const getModelStatus = (model) => {
    // Check if currently downloading
    const download = downloads.get(model.id)
    if (download) {
      return {
        isDownloading: true,
        progress: download.progress || 0,
        downloadedBytes: download.downloadedBytes || 0,
        totalBytes: download.totalBytes || 0,
        speed: download.speed || 0,
        status: download.status || 'downloading'
      }
    }
    
    // Check if in downloading set (for immediate feedback)
    if (downloadingModels.current.has(model.id)) {
      return {
        isDownloading: true,
        progress: 0,
        status: 'starting'
      }
    }
    
    // Check if installed
    const isInstalled = installedModels.some(installed => installed.id === model.id)
    
    return {
      isDownloading: false,
      isInstalled,
      progress: 0
    }
  }

  const getSpeedColor = (speed) => {
    if (!speed) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    
    switch (speed.toLowerCase()) {
      case 'very fast':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'fast':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'medium-slow':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      case 'slow':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  const getAccuracyColor = (accuracy) => {
    if (!accuracy) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    
    switch (accuracy.toLowerCase()) {
      case 'outstanding':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case 'excellent':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case 'very good':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
      case 'good':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'basic':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  // Show proper loading state and error handling
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading models...</span>
        </div>
      </div>
    )
  }

  // Show message when no Electron API
  if (!isElectron) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Electron Required</h3>
            <p className="text-muted-foreground">
              Model management is only available in the Electron app.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-2">
          <CardHeader className="pb-1 px-2">
            <CardTitle className="text-sm font-medium">Available Models</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <div className="text-xl font-bold">{availableModels.length}</div>
          </CardContent>
        </Card>
        <Card className="p-2">
          <CardHeader className="pb-1 px-2">
            <CardTitle className="text-sm font-medium">Installed Models</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <div className="text-xl font-bold">{installedModels.length}</div>
          </CardContent>
        </Card>
        <Card className="p-2">
          <CardHeader className="pb-1 px-2">
            <CardTitle className="text-sm font-medium">Active Downloads</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <div className="text-xl font-bold">{downloads.size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Models Marketplace */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Model Marketplace
              </CardTitle>
              <CardDescription>
                Download and manage your WhisperDesk models
              </CardDescription>
            </div>
            {/* FIXED: Refresh button with proper loading state */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={loading || refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableModels.map((model) => {
                const status = getModelStatus(model)
                
                return (
                  <Card key={model.id} className="relative overflow-hidden p-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{model.name}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{model.description}</p>
                        </div>
                        {status.isInstalled && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">
                            <Check className="w-3 h-3" />
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {model.speed && (
                          <Badge variant="secondary" className={`text-xs py-0 px-1.5 ${getSpeedColor(model.speed)}`}>
                            <Gauge className="w-2.5 h-2.5 mr-0.5" />
                            {model.speed}
                          </Badge>
                        )}
                        {model.accuracy && (
                          <Badge variant="secondary" className={`text-xs py-0 px-1.5 ${getAccuracyColor(model.accuracy)}`}>
                            <Check className="w-2.5 h-2.5 mr-0.5" />
                            {model.accuracy}
                          </Badge>
                        )}
                        {model.size && (
                          <Badge variant="secondary" className="text-xs py-0 px-1.5 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                            <HardDrive className="w-2.5 h-2.5 mr-0.5" />
                            {model.size}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        {status.isDownloading ? (
                          <div className="flex items-center gap-2 w-full">
                            <div className="flex-1">
                              <Progress value={status.progress} className="h-1.5" />
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {status.status === 'queued' ? 'Queued...' : 
                                   status.status === 'starting' ? 'Starting...' :
                                   `${status.progress}%`}
                                </span>
                                {status.speed > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatSpeed(status.speed)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancelDownload(model.id)}
                              className="h-6 w-6"
                              aria-label="Cancel download"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : status.isInstalled ? (
                          <div className="flex justify-end w-full">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteModel(model.id)}
                              className="h-6 w-6 text-destructive hover:text-destructive/90"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end w-full">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadModel(model.id)}
                              disabled={!isElectron}
                              className="h-6 text-xs px-2"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Debug Panel */}
      {process.env.NODE_ENV === 'development' && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Debug Information</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowDebug(!showDebug)}
              >
                {showDebug ? 'Hide' : 'Show'} Debug
              </Button>
            </div>
          </CardHeader>
          {showDebug && (
            <CardContent className="pt-0">
              <div className="space-y-3 text-xs">
                <div>
                  <strong>State Updated:</strong> {new Date(lastStateUpdate.current).toLocaleTimeString()}
                </div>
                <div>
                  <strong>Downloading Models:</strong> {Array.from(downloadingModels.current).join(', ') || 'None'}
                </div>
                <div>
                  <strong>Available Models:</strong> {availableModels.length}
                  {availableModels.length > 0 && (
                    <div className="ml-4 mt-1">
                      {availableModels.slice(0, 3).map(m => <div key={m.id}>• {m.id} ({m.name})</div>)}
                    </div>
                  )}
                </div>
                <div>
                  <strong>Installed Models:</strong> {installedModels.length}
                  {installedModels.length > 0 && (
                    <div className="ml-4 mt-1">
                      {installedModels.map(m => <div key={m.id}>• {m.id} ({m.name || 'No name'})</div>)}
                    </div>
                  )}
                </div>
                <div>
                  <strong>Active Downloads:</strong> {downloads.size}
                  {downloads.size > 0 && (
                    <div className="ml-4 mt-1">
                      {Array.from(downloads.entries()).map(([id, info]) => (
                        <div key={id}>• {id} ({info.status}) - {Math.round(info.progress || 0)}%</div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <strong>Model Status Sample:</strong>
                  {availableModels.slice(0, 2).map(model => {
                    const status = getModelStatus(model)
                    return (
                      <div key={model.id} className="ml-4">
                        • {model.id}: installed={status.isInstalled ? 'YES' : 'NO'}, downloading={status.isDownloading ? 'YES' : 'NO'}
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}