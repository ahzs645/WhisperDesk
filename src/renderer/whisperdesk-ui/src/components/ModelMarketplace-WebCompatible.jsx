// src/renderer/whisperdesk-ui/src/components/ModelMarketplace-Fixed.jsx
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Package, Download, Trash2, HardDrive, Gauge, Clock, Check, AlertCircle, Loader2 } from 'lucide-react'
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

  useEffect(() => {
    const electronAvailable = typeof window !== 'undefined' && window.electronAPI

    setIsElectron(electronAvailable)

    if (electronAvailable) {
      initializeElectronAPI()
    } else {
      initializeWebAPI()
    }

    return () => {
      // Cleanup event handlers
      if (downloadProgressCleanup.current) downloadProgressCleanup.current()
      if (downloadCompleteCleanup.current) downloadCompleteCleanup.current()
      if (downloadErrorCleanup.current) downloadErrorCleanup.current()
      if (downloadQueuedCleanup.current) downloadQueuedCleanup.current()
    }
  }, [])

  const initializeElectronAPI = async () => {
    try {
      setupElectronEventHandlers()
      await loadModelsFromElectron()
    } catch (error) {
      console.error('Failed to initialize Electron API:', error)
      toast.error('Failed to load models: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const setupElectronEventHandlers = () => {
    console.log('Setting up model download event handlers...')

    // Download Progress Handler - REAL-TIME UPDATES
    if (window.electronAPI.model.onDownloadProgress) {
      downloadProgressCleanup.current = window.electronAPI.model.onDownloadProgress((data) => {
        console.log('Download progress:', data.modelId, data.progress + '%')
        
        setDownloads(prev => {
          const updated = new Map(prev)
          updated.set(data.modelId, {
            ...updated.get(data.modelId),
            progress: data.progress,
            downloadedBytes: data.downloadedBytes,
            totalBytes: data.totalBytes,
            speed: data.speed,
            status: 'downloading'
          })
          return updated
        })
      })
      console.log('✅ Download progress handler set up')
    }

    // Download Complete Handler
    if (window.electronAPI.model.onDownloadComplete) {
      downloadCompleteCleanup.current = window.electronAPI.model.onDownloadComplete((data) => {
        console.log('Download complete:', data.modelId)
        
        setDownloads(prev => {
          const updated = new Map(prev)
          updated.delete(data.modelId) // Remove from downloads
          return updated
        })

        // Refresh installed models
        loadInstalledModels()
        
        toast.success(`✅ Model downloaded successfully!`)
      })
      console.log('✅ Download complete handler set up')
    }

    // Download Error Handler
    if (window.electronAPI.model.onDownloadError) {
      downloadErrorCleanup.current = window.electronAPI.model.onDownloadError((data) => {
        console.error('Download error:', data.modelId, data.error)
        
        setDownloads(prev => {
          const updated = new Map(prev)
          updated.delete(data.modelId) // Remove from downloads
          return updated
        })
        
        toast.error(`❌ Download failed: ${data.error}`)
      })
      console.log('✅ Download error handler set up')
    }

    // Download Queued Handler
    if (window.electronAPI.model.onDownloadQueued) {
      downloadQueuedCleanup.current = window.electronAPI.model.onDownloadQueued((data) => {
        console.log('Download queued:', data.modelId)
        
        setDownloads(prev => {
          const updated = new Map(prev)
          updated.set(data.modelId, {
            progress: 0,
            downloadedBytes: 0,
            totalBytes: data.model?.sizeBytes || 0,
            speed: 0,
            status: 'queued'
          })
          return updated
        })
        
        toast.success(`📥 Download started: ${data.model?.name}`)
      })
      console.log('✅ Download queued handler set up')
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

  const initializeWebAPI = async () => {
    // For web interface - you could implement web-based model management here
    setAvailableModels([
      {
        id: 'whisper-tiny',
        name: 'Whisper Tiny',
        size: '39 MB',
        sizeBytes: 39000000,
        description: 'Fastest model, English only, good for real-time transcription',
        accuracy: 'Basic',
        speed: 'Very Fast',
        isInstalled: false
      },
      {
        id: 'whisper-base',
        name: 'Whisper Base', 
        size: '142 MB',
        sizeBytes: 142000000,
        description: 'Good balance of speed and accuracy',
        accuracy: 'Good',
        speed: 'Fast',
        isInstalled: false
      }
    ])
    setLoading(false)
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
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Available Models</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableModels.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Installed Models</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{installedModels.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Downloads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{downloads.size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Models Marketplace */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Model Marketplace
          </CardTitle>
          <CardDescription>
            Download and manage your WhisperDesk models
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {availableModels.map((model) => {
              const status = getModelStatus(model)
              const isInstalled = installedModels.some(m => m.id === model.id)
              
              return (
                <Card key={model.id} className="relative overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{model.name}</h3>
                          {isInstalled && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <Check className="w-3 h-3 mr-1" />
                              Installed
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{model.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          {model.speed && (
                            <Badge variant="secondary" className={getSpeedColor(model.speed)}>
                              <Gauge className="w-3 h-3 mr-1" />
                              {model.speed}
                            </Badge>
                          )}
                          {model.accuracy && (
                            <Badge variant="secondary" className={getAccuracyColor(model.accuracy)}>
                              <Check className="w-3 h-3 mr-1" />
                              {model.accuracy}
                            </Badge>
                          )}
                          {model.size && (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                              <HardDrive className="w-3 h-3 mr-1" />
                              {model.size}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {status.isDownloading ? (
                            <div className="flex items-center gap-2">
                              <Progress value={status.progress} className="w-24" />
                              <span className="text-sm text-muted-foreground">
                                {status.progress}%
                              </span>
                            </div>
                          ) : isInstalled ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteModel(model.id)}
                              className="text-destructive hover:text-destructive/90"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadModel(model.id)}
                              disabled={!isElectron}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}