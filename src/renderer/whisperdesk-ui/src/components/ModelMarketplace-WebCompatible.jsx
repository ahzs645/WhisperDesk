// src/renderer/whisperdesk-ui/src/components/ModelMarketplace-Fixed.jsx
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Package, Download, Trash2, HardDrive, Gauge, Clock, Check, AlertCircle, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

export function ModelMarketplace() {
  const [availableModels, setAvailableModels] = useState([])
  const [installedModels, setInstalledModels] = useState([])
  const [downloads, setDownloads] = useState(new Map()) // Track download progress
  const [loading, setLoading] = useState(true)
  const [isElectron, setIsElectron] = useState(false)

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
    console.log('Setting up model download event handlers...')

    // Progress handler
    if (window.electronAPI.model.onDownloadProgress) {
      downloadProgressCleanup.current = window.electronAPI.model.onDownloadProgress((data) => {
        console.log('Download progress:', data)
        setDownloads(prev => new Map(prev).set(data.modelId, {
          ...prev.get(data.modelId),
          progress: data.progress,
          status: 'downloading'
        }))
      })
    }

    // Completion handler
    if (window.electronAPI.model.onDownloadComplete) {
      downloadCompleteCleanup.current = window.electronAPI.model.onDownloadComplete((data) => {
        console.log('Download complete:', data)
        setDownloads(prev => {
          const next = new Map(prev)
          next.delete(data.modelId)
          return next
        })
        
        // Refresh installed models
        loadModelsFromElectron()
        
        toast.success('Model downloaded successfully!')
      })
    }

    // Error handler
    if (window.electronAPI.model.onDownloadError) {
      downloadErrorCleanup.current = window.electronAPI.model.onDownloadError((data) => {
        console.error('Download error:', data)
        setDownloads(prev => {
          const next = new Map(prev)
          next.delete(data.modelId)
          return next
        })
        
        toast.error('Failed to download model: ' + data.error)
      })
    }

    // Queue handler
    if (window.electronAPI.model.onDownloadQueued) {
      downloadQueuedCleanup.current = window.electronAPI.model.onDownloadQueued((data) => {
        console.log('Download queued:', data)
        setDownloads(prev => new Map(prev).set(data.modelId, {
          progress: 0,
          status: 'queued'
        }))
      })
    }

    // Cancellation handler
    if (window.electronAPI.model.onDownloadCancelled) {
      downloadCancelledCleanup.current = window.electronAPI.model.onDownloadCancelled((data) => {
        console.log('Download cancelled:', data)
        setDownloads(prev => {
          const next = new Map(prev)
          next.delete(data.modelId)
          return next
        })
        
        toast.info('Download cancelled')
      })
    }
  }

  const loadModelsFromElectron = async () => {
    await Promise.all([
      loadAvailableModels(),
      loadInstalledModels()
    ])
  }

  const loadAvailableModels = async () => {
    try {
      const models = await window.electronAPI.model.getAvailable()
      setAvailableModels(models)
      console.log('Loaded available models:', models.length)
    } catch (error) {
      console.error('Failed to load available models:', error)
      toast.error('Failed to load available models')
    }
  }

  const loadInstalledModels = async () => {
    try {
      const models = await window.electronAPI.model.getInstalled()
      setInstalledModels(models)
      console.log('Loaded installed models:', models.length)
    } catch (error) {
      console.error('Failed to load installed models:', error)
      toast.error('Failed to load installed models')
    }
  }

  const handleDownloadModel = async (modelId) => {
    if (!isElectron) {
      toast.error('Model downloads only available in Electron app')
      return
    }

    try {
      console.log('Starting download for model:', modelId)
      await window.electronAPI.model.download(modelId)
      // The download progress will be handled by event handlers
    } catch (error) {
      console.error('Failed to start download:', error)
      toast.error('Failed to start download: ' + error.message)
    }
  }

  const handleCancelDownload = async (modelId) => {
    if (!isElectron) return
    try {
      await window.electronAPI.model.cancelDownload(modelId)
      setDownloads(prev => {
        const updated = new Map(prev)
        updated.delete(modelId)
        return updated
      })
      toast.warning('Download cancelled')
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
      await window.electronAPI.model.delete(modelId)
      await loadInstalledModels()
      toast.success('Model deleted successfully')
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

  const roundProgress = (progress) => {
    return Math.round(progress)
  }

  const formatSpeed = (bytesPerSecond) => {
    if (!bytesPerSecond) return ''
    return formatBytes(bytesPerSecond) + '/s'
  }

  const getModelStatus = (model) => {
    const download = downloads.get(model.id)
    if (download) {
      return {
        isDownloading: true,
        progress: download.progress,
        downloadedBytes: download.downloadedBytes,
        totalBytes: download.totalBytes,
        speed: download.speed,
        status: download.status
      }
    }
    
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
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Model Marketplace
          </CardTitle>
          <CardDescription>
            Download and manage your WhisperDesk models
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableModels.map((model) => {
                const status = getModelStatus(model)
                const isInstalled = installedModels.some(m => m.id === model.id)
                
                return (
                  <Card key={model.id} className="relative overflow-hidden p-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{model.name}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{model.description}</p>
                        </div>
                        {isInstalled && (
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
                        {status.isDownloading || status.status === 'queued' ? (
                          <div className="flex items-center gap-2 w-full">
                            <Progress value={roundProgress(status.progress)} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {status.status === 'queued' ? 'Queued' : `${roundProgress(status.progress)}%`}
                            </span>
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
                        ) : isInstalled ? (
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
    </div>
  )
}