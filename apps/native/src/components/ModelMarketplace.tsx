import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Badge } from '@repo/ui/components/badge'
import { Progress } from '@repo/ui/components/progress'
import { ScrollArea } from '@repo/ui/components/scroll-area'
import { Package, Download, Trash2, HardDrive, Gauge, Check, Loader2, X, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  getModelsFolder,
  downloadModel,
  onDownloadProgress,
} from '../lib/tauri-bindings'
import { invoke } from '@tauri-apps/api/core'

// Model configurations (adapted from Electron app)
const WHISPER_MODELS = [
  {
    id: 'whisper-tiny',
    name: 'Whisper Tiny',
    provider: 'OpenAI',
    size: '39 MB',
    sizeBytes: 39000000,
    description: 'Fastest model, English only, good for real-time transcription',
    accuracy: 'Basic',
    speed: 'Very Fast',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    expectedFilename: 'ggml-tiny.bin'
  },
  {
    id: 'whisper-small',
    name: 'Whisper Small',
    provider: 'OpenAI',
    size: '461 MB',
    sizeBytes: 461000000,
    description: 'Better accuracy than base, still reasonably fast',
    accuracy: 'Very Good',
    speed: 'Medium',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    expectedFilename: 'ggml-small.bin'
  },
  {
    id: 'whisper-medium',
    name: 'Whisper Medium',
    provider: 'OpenAI',
    size: '1.42 GB',
    sizeBytes: 1420000000,
    description: 'High accuracy, good for professional transcription',
    accuracy: 'Excellent',
    speed: 'Medium-Slow',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    expectedFilename: 'ggml-medium.bin'
  },
  {
    id: 'whisper-large-v3-turbo',
    name: 'Whisper Large v3 Turbo',
    provider: 'OpenAI',
    size: '1.6 GB',
    sizeBytes: 1600000000,
    description: 'Optimized large model with turbo speed',
    accuracy: 'Outstanding',
    speed: 'Medium',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
    expectedFilename: 'ggml-large-v3-turbo.bin'
  }
]

interface DownloadState {
  progress: number
  status: 'starting' | 'downloading' | 'queued'
  downloadedBytes: number
  totalBytes: number
  speed?: number
}

export function ModelMarketplace() {
  const [modelsFolder, setModelsFolder] = useState<string>('')
  const [installedModels, setInstalledModels] = useState<Set<string>>(new Set())
  const [downloads, setDownloads] = useState<Map<string, DownloadState>>(new Map())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const downloadingModels = useRef(new Set<string>())

  useEffect(() => {
    loadModelsData()
    setupProgressListener()
  }, [])

  const setupProgressListener = async () => {
    await onDownloadProgress((current, total) => {
      const progress = (current / total) * 100

      // Find which model is downloading (track in ref)
      downloadingModels.current.forEach(modelId => {
        setDownloads(prev => {
          const next = new Map(prev)
          const existing = next.get(modelId) || {} as DownloadState

          next.set(modelId, {
            ...existing,
            progress: Math.round(progress),
            status: 'downloading',
            downloadedBytes: current,
            totalBytes: total
          })

          return next
        })
      })
    })
  }

  const loadModelsData = async () => {
    try {
      setLoading(true)
      const folder = await getModelsFolder()
      setModelsFolder(folder)

      // Check which models are installed
      const installed = new Set<string>()
      for (const model of WHISPER_MODELS) {
        const exists = await invoke<boolean>('file_exists', {
          path: `${folder}/${model.expectedFilename}`
        })
        if (exists) {
          installed.add(model.id)
        }
      }
      setInstalledModels(installed)
    } catch (error) {
      console.error('Failed to load models:', error)
      toast.error('Failed to load models list')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (refreshing) return

    try {
      setRefreshing(true)
      await loadModelsData()
      toast.success('🔄 Models refreshed!')
    } catch (error) {
      toast.error('Failed to refresh')
    } finally {
      setRefreshing(false)
    }
  }

  const handleDownloadModel = async (model: typeof WHISPER_MODELS[0]) => {
    // Prevent duplicates
    if (downloadingModels.current.has(model.id)) {
      toast.warning('📥 Download already in progress')
      return
    }

    if (installedModels.has(model.id)) {
      toast.warning('📦 Model is already installed')
      return
    }

    downloadingModels.current.add(model.id)

    try {
      console.log(`🚀 Starting download for model: ${model.id}`)

      setDownloads(prev => new Map(prev).set(model.id, {
        progress: 0,
        status: 'starting',
        downloadedBytes: 0,
        totalBytes: model.sizeBytes
      }))

      const modelPath = `${modelsFolder}/${model.expectedFilename}`
      await downloadModel(model.downloadUrl, modelPath)

      // Download complete
      setDownloads(prev => {
        const next = new Map(prev)
        next.delete(model.id)
        return next
      })

      downloadingModels.current.delete(model.id)

      // Refresh installed models
      await loadModelsData()

      toast.success(`✅ ${model.name} downloaded successfully!`)
    } catch (error) {
      console.error(`❌ Failed to download ${model.id}:`, error)

      downloadingModels.current.delete(model.id)
      setDownloads(prev => {
        const next = new Map(prev)
        next.delete(model.id)
        return next
      })

      toast.error(`❌ Failed to download: ${String(error)}`)
    }
  }

  const handleCancelDownload = async (modelId: string) => {
    try {
      // Emit abort event (Tauri style)
      await invoke('abort_download')

      downloadingModels.current.delete(modelId)
      setDownloads(prev => {
        const next = new Map(prev)
        next.delete(modelId)
        return next
      })

      toast.info('📥 Download cancelled')
    } catch (error) {
      console.error('Failed to cancel download:', error)
      toast.error('Failed to cancel download')
    }
  }

  const handleDeleteModel = async (model: typeof WHISPER_MODELS[0]) => {
    try {
      console.log('🗑️ Deleting model:', model.id)

      const modelPath = `${modelsFolder}/${model.expectedFilename}`
      await invoke('delete_file', { path: modelPath })

      setInstalledModels(prev => {
        const next = new Set(prev)
        next.delete(model.id)
        return next
      })

      toast.success('🗑️ Model deleted successfully')
    } catch (error) {
      console.error('Failed to delete model:', error)
      toast.error('Failed to delete model')
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number) => {
    if (!bytesPerSecond) return ''
    return `${formatBytes(bytesPerSecond)}/s`
  }

  const getSpeedColor = (speed: string) => {
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

  const getAccuracyColor = (accuracy: string) => {
    switch (accuracy.toLowerCase()) {
      case 'outstanding':
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
            <div className="text-xl font-bold">{WHISPER_MODELS.length}</div>
          </CardContent>
        </Card>
        <Card className="p-2">
          <CardHeader className="pb-1 px-2">
            <CardTitle className="text-sm font-medium">Installed Models</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <div className="text-xl font-bold">{installedModels.size}</div>
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
                Download and manage your Whisper models
              </CardDescription>
            </div>
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
              {WHISPER_MODELS.map((model) => {
                const isInstalled = installedModels.has(model.id)
                const download = downloads.get(model.id)
                const isDownloading = !!download

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
                        {isDownloading ? (
                          <div className="flex items-center gap-2 w-full">
                            <div className="flex-1">
                              <Progress value={download.progress} className="h-1.5" />
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {download.status === 'queued' ? 'Queued...' :
                                   download.status === 'starting' ? 'Starting...' :
                                   `${download.progress}%`}
                                </span>
                                {download.speed && download.speed > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatSpeed(download.speed)}
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
                        ) : isInstalled ? (
                          <div className="flex justify-end w-full">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteModel(model)}
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
                              onClick={() => handleDownloadModel(model)}
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
