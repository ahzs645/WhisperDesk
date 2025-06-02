// src/renderer/whisperdesk-ui/src/components/ModelMarketplace-Fixed.jsx
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Package, Download, Trash2, HardDrive, Wifi, Clock, Check, AlertCircle, Loader2 } from 'lucide-react'
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
        description: 'Fastest model, good for testing',
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

  const ModelCard = ({ model }) => {
    const status = getModelStatus(model)
    
    return (
      <Card key={model.id} className="relative">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">{model.name}</CardTitle>
              <CardDescription>{model.description}</CardDescription>
            </div>
            <div className="flex flex-col items-end space-y-1">
              <Badge variant={status.isInstalled ? 'default' : 'secondary'}>
                {model.size}
              </Badge>
              {status.isInstalled && (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <Check className="w-3 h-3 mr-1" />
                  Installed
                </Badge>
              )}
              {status.isDownloading && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  {status.status === 'queued' ? 'Queued' : 'Downloading'}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Model Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>Speed: {model.speed}</span>
            </div>
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
              <span>Accuracy: {model.accuracy}</span>
            </div>
          </div>

          {/* Download Progress */}
          {status.isDownloading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {status.status === 'queued' ? 'Queued for download...' : 
                   `${Math.round(status.progress)}% - ${formatBytes(status.downloadedBytes)} / ${formatBytes(status.totalBytes)}`}
                </span>
                {status.speed > 0 && (
                  <span className="text-muted-foreground">
                    {formatSpeed(status.speed)}
                  </span>
                )}
              </div>
              <Progress value={status.progress} className="w-full" />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {!status.isInstalled && !status.isDownloading && (
              <Button 
                onClick={() => handleDownloadModel(model.id)}
                className="flex-1"
                disabled={!isElectron}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
            
            {status.isInstalled && (
              <Button 
                onClick={() => handleDeleteModel(model.id)}
                variant="outline"
                disabled={!isElectron}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
            
            {status.isDownloading && (
              <Button disabled className="flex-1">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {status.status === 'queued' ? 'Queued...' : `Downloading ${Math.round(status.progress)}%`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Model Marketplace</h2>
          <p className="text-muted-foreground">
            Download and manage Whisper models for transcription
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {isElectron ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <HardDrive className="w-3 h-3 mr-1" />
              Local Storage
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              <Wifi className="w-3 h-3 mr-1" />
              Web Preview
            </Badge>
          )}
        </div>
      </div>

      {!isElectron && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-orange-800">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">
                Model downloads are only available in the Electron app. Use the web interface for testing with existing models.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Available Models</span>
            </div>
            <div className="text-2xl font-bold">{availableModels.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Installed Models</span>
            </div>
            <div className="text-2xl font-bold">{installedModels.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Download className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">Active Downloads</span>
            </div>
            <div className="text-2xl font-bold">{downloads.size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Downloads Section */}
      {downloads.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download className="w-5 h-5" />
              <span>Active Downloads</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from(downloads.entries()).map(([modelId, download]) => {
                const model = availableModels.find(m => m.id === modelId)
                if (!model) return null
                
                return (
                  <div key={modelId} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{model.name}</span>
                      <span>
                        {download.status === 'queued' ? 'Queued' : 
                         `${Math.round(download.progress)}% - ${formatSpeed(download.speed)}`}
                      </span>
                    </div>
                    <Progress value={download.progress} className="w-full" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Models */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Available Models</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableModels.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))}
        </div>
      </div>

      {availableModels.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Models Available</h3>
            <p className="text-muted-foreground">
              Unable to load available models. Please check your connection.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}