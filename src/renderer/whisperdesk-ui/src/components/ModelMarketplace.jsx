import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  Download, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  HardDrive,
  Zap,
  Star,
  Globe,
  Info
} from 'lucide-react'

export function ModelMarketplace() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState({})
  const [downloadingModels, setDownloadingModels] = useState(new Set())

  useEffect(() => {
    loadModels()
    setupEventListeners()
    
    return () => {
      // Cleanup event listeners
      if (window.electronAPI?.model?.onDownloadProgress) {
        window.electronAPI.model.onDownloadProgress(() => {})
      }
      if (window.electronAPI?.model?.onDownloadComplete) {
        window.electronAPI.model.onDownloadComplete(() => {})
      }
      if (window.electronAPI?.model?.onDownloadError) {
        window.electronAPI.model.onDownloadError(() => {})
      }
    }
  }, [])

  const setupEventListeners = () => {
    if (!window.electronAPI?.model) return

    // Download queued
    window.electronAPI.model.onDownloadQueued((event, data) => {
      setDownloadingModels(prev => new Set(prev).add(data.modelId))
      setDownloadProgress(prev => ({
        ...prev,
        [data.modelId]: {
          progress: 0,
          downloadedBytes: 0,
          totalBytes: data.model?.sizeBytes || 0,
          speed: 0,
          status: 'queued'
        }
      }))
    })

    // Download progress
    window.electronAPI.model.onDownloadProgress((event, data) => {
      setDownloadProgress(prev => ({
        ...prev,
        [data.modelId]: {
          progress: data.progress,
          downloadedBytes: data.downloadedBytes,
          totalBytes: data.totalBytes,
          speed: data.speed,
          status: 'downloading'
        }
      }))
    })

    // Download complete
    window.electronAPI.model.onDownloadComplete((event, data) => {
      setDownloadingModels(prev => {
        const newSet = new Set(prev)
        newSet.delete(data.modelId)
        return newSet
      })
      setDownloadProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[data.modelId]
        return newProgress
      })
      loadModels() // Refresh the models list
      setError(null) // Clear any previous errors
    })

    // Download error
    window.electronAPI.model.onDownloadError((event, data) => {
      setDownloadingModels(prev => {
        const newSet = new Set(prev)
        newSet.delete(data.modelId)
        return newSet
      })
      setDownloadProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[data.modelId]
        return newProgress
      })
      setError(`Failed to download ${data.modelId}: ${data.error}`)
    })

    // Download cancelled
    window.electronAPI.model.onDownloadCancelled((event, data) => {
      setDownloadingModels(prev => {
        const newSet = new Set(prev)
        newSet.delete(data.modelId)
        return newSet
      })
      setDownloadProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[data.modelId]
        return newProgress
      })
    })
  }

  const loadModels = async () => {
    try {
      setLoading(true)
      setError(null)
      
      if (!window.electronAPI?.model?.getAvailable) {
        throw new Error('Model API not available')
      }
      
      const availableModels = await window.electronAPI.model.getAvailable()
      setModels(availableModels)
    } catch (err) {
      setError(`Failed to load models: ${err.message}`)
      console.error('Error loading models:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (modelId) => {
    try {
      setError(null)
      setDownloadingModels(prev => new Set(prev).add(modelId))
      
      await window.electronAPI.model.download(modelId)
    } catch (err) {
      setError(`Failed to start download: ${err.message}`)
      setDownloadingModels(prev => {
        const newSet = new Set(prev)
        newSet.delete(modelId)
        return newSet
      })
    }
  }

  const handleDelete = async (modelId) => {
    try {
      setError(null)
      await window.electronAPI.model.delete(modelId)
      await loadModels() // Refresh the models list
    } catch (err) {
      setError(`Failed to delete model: ${err.message}`)
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
    return formatBytes(bytesPerSecond) + '/s'
  }

  const getAccuracyColor = (accuracy) => {
    switch (accuracy?.toLowerCase()) {
      case 'basic': return 'bg-yellow-100 text-yellow-800'
      case 'good': return 'bg-blue-100 text-blue-800'
      case 'very good': return 'bg-green-100 text-green-800'
      case 'excellent': return 'bg-purple-100 text-purple-800'
      case 'outstanding': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSpeedColor = (speed) => {
    switch (speed?.toLowerCase()) {
      case 'very fast': return 'bg-green-100 text-green-800'
      case 'fast': return 'bg-blue-100 text-blue-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'medium-slow': return 'bg-orange-100 text-orange-800'
      case 'slow': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading models...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {models.map((model) => {
          const isDownloading = downloadingModels.has(model.id)
          const progress = downloadProgress[model.id]
          
          return (
            <Card key={model.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {model.name}
                      {model.isInstalled && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                    </CardTitle>
                    <CardDescription>{model.description}</CardDescription>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>by {model.provider}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <span>v{model.version}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {model.isInstalled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(model.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleDownload(model.id)}
                        disabled={isDownloading}
                        size="sm"
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Downloading
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Download Progress */}
                {isDownloading && progress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>
                        {progress.status === 'queued' ? 'Queued for download...' : 
                         progress.status === 'downloading' ? 'Downloading...' : 'Processing...'}
                      </span>
                      <span>{Math.round(progress.progress)}%</span>
                    </div>
                    <Progress value={progress.progress} className="w-full" />
                    {progress.status === 'downloading' && progress.totalBytes > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
                        </span>
                        <span>{formatSpeed(progress.speed)}</span>
                      </div>
                    )}
                    {progress.status === 'queued' && (
                      <div className="text-xs text-muted-foreground text-center">
                        Download will start shortly...
                      </div>
                    )}
                  </div>
                )}

                {/* Model Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <HardDrive className="w-4 h-4" />
                      Size
                    </div>
                    <div className="text-sm text-muted-foreground">{model.size}</div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <Star className="w-4 h-4" />
                      Accuracy
                    </div>
                    <Badge variant="secondary" className={getAccuracyColor(model.accuracy)}>
                      {model.accuracy}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <Zap className="w-4 h-4" />
                      Speed
                    </div>
                    <Badge variant="secondary" className={getSpeedColor(model.speed)}>
                      {model.speed}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <Globe className="w-4 h-4" />
                      Languages
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {Array.isArray(model.languages) 
                        ? model.languages.includes('multilingual') 
                          ? '80+ languages' 
                          : model.languages.join(', ')
                        : model.languages}
                    </div>
                  </div>
                </div>

                {/* Requirements */}
                {model.requirements && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <Info className="w-4 h-4" />
                      System Requirements
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>RAM: {model.requirements.ram}</div>
                      <div>Disk: {model.requirements.disk}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {models.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No models available</p>
          <Button onClick={loadModels} variant="outline" className="mt-2">
            Refresh
          </Button>
        </div>
      )}
    </div>
  )
}

