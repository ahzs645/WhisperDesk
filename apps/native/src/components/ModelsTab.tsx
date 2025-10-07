import React, { useState, useEffect } from 'react'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Progress } from '@repo/ui/components/progress'
import { Package, FolderOpen, CheckCircle2, Download } from 'lucide-react'
import { toast } from 'sonner'
import {
  getModelsFolder,
  listModels,
  loadModel,
  downloadModel,
  onDownloadProgress,
  type LoadModelOptions
} from '../lib/tauri-bindings'
import { invoke } from '@tauri-apps/api/core'

const MODEL_URLS = {
  'tiny': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  'base': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  'small': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  'medium': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
}

export function ModelsTab() {
  const [modelsFolder, setModelsFolder] = useState<string>('')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadedModel, setLoadedModel] = useState<string | null>(null)
  const [downloadURL, setDownloadURL] = useState<string>('')
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    loadModelsData()

    // Setup download progress listener
    const setupProgressListener = async () => {
      await onDownloadProgress((current, total) => {
        const progress = (current / total) * 100
        setDownloadProgress(progress)
      })
    }

    setupProgressListener()
  }, [])

  const loadModelsData = async () => {
    try {
      const folder = await getModelsFolder()
      setModelsFolder(folder)

      const models = await listModels(folder)
      setAvailableModels(models)

      if (models.length > 0 && !selectedModel) {
        setSelectedModel(models[0])
      }
    } catch (error) {
      console.error('Failed to load models:', error)
      toast.error('Failed to load models list')
    }
  }

  const handleLoadModel = async () => {
    if (!selectedModel) {
      toast.error('Please select a model first')
      return
    }

    setIsLoading(true)
    toast.info('Loading model...')

    try {
      const modelPath = `${modelsFolder}/${selectedModel}`

      const options: LoadModelOptions = {
        model_path: modelPath,
        use_gpu: false, // CoreML is used automatically on macOS
      }

      const result = await loadModel(options)
      setLoadedModel(selectedModel)
      toast.success('Model loaded successfully!')
      console.log(result)
    } catch (error) {
      console.error('Model loading error:', error)
      toast.error('Failed to load model: ' + String(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenModelsFolder = async () => {
    try {
      await invoke('open_path', { path: modelsFolder })
    } catch (error) {
      console.error('Failed to open models folder:', error)
      toast.error('Failed to open models folder')
    }
  }

  const handleRefresh = () => {
    loadModelsData()
    toast.info('Refreshing models list...')
  }

  const handleDownloadModel = async (url?: string) => {
    const urlToDownload = url || downloadURL
    if (!urlToDownload) {
      toast.error('Please enter a model URL')
      return
    }

    setIsDownloading(true)
    setDownloadProgress(0)
    toast.info('Downloading model...')

    try {
      // Extract filename from URL
      const urlObj = new URL(urlToDownload)
      const filename = urlObj.pathname.split('/').pop() || 'model.bin'
      const modelPath = `${modelsFolder}/${filename}`

      await downloadModel(urlToDownload, modelPath)

      setDownloadProgress(0)
      toast.success('Model downloaded successfully!')
      setDownloadURL('')
      await loadModelsData()
      setSelectedModel(filename)
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download model: ' + String(error))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Whisper Models
          </CardTitle>
          <CardDescription>
            Load a Whisper model to enable transcription
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Models Folder Info */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Models Folder</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={modelsFolder}
                readOnly
                className="flex-1 px-3 py-2 border rounded-md bg-muted text-sm"
              />
              <Button variant="outline" size="sm" onClick={handleOpenModelsFolder}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Open
              </Button>
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Available Models</label>
            <div className="flex gap-2">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md bg-background"
                disabled={availableModels.length === 0}
              >
                {availableModels.length === 0 ? (
                  <option>No models found</option>
                ) : (
                  availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))
                )}
              </select>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                Refresh
              </Button>
            </div>
            {availableModels.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Place .bin or .gguf model files in the models folder
              </p>
            )}
          </div>

          {/* Load Model Button */}
          <Button
            onClick={handleLoadModel}
            disabled={!selectedModel || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                Loading Model...
              </>
            ) : loadedModel === selectedModel ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Model Loaded: {selectedModel}
              </>
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" />
                Load Model
              </>
            )}
          </Button>

          {/* Current Status */}
          {loadedModel && (
            <div className="p-3 border rounded-md bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Currently loaded: <strong>{loadedModel}</strong></span>
              </div>
            </div>
          )}

          {/* Download Section */}
          <div className="mt-6 space-y-3">
            <label className="text-sm font-medium">Download Model</label>

            {/* Quick Download Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(MODEL_URLS).map(([name, url]) => (
                <Button
                  key={name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadModel(url)}
                  disabled={isDownloading}
                  className="capitalize"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {name}
                </Button>
              ))}
            </div>

            {/* Custom URL Download */}
            <div className="flex gap-2">
              <input
                type="text"
                value={downloadURL}
                onChange={(e) => setDownloadURL(e.target.value)}
                placeholder="Or paste model URL..."
                className="flex-1 px-3 py-2 border rounded-md text-sm"
                disabled={isDownloading}
                onKeyDown={(e) => e.key === 'Enter' && handleDownloadModel()}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadModel()}
                disabled={isDownloading || !downloadURL}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>

            {/* Download Progress */}
            {isDownloading && (
              <div className="space-y-2">
                <Progress value={downloadProgress} />
                <p className="text-xs text-muted-foreground text-center">
                  Downloading... {Math.round(downloadProgress)}%
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Model Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2 text-muted-foreground">
            <p><strong>tiny</strong> - Fastest, lower accuracy (~75MB)</p>
            <p><strong>base</strong> - Good balance (~142MB) - Recommended</p>
            <p><strong>small</strong> - Better accuracy (~466MB)</p>
            <p><strong>medium</strong> - High accuracy (~1.5GB)</p>
            <p className="mt-4 pt-4 border-t">
              You can also download models manually from{' '}
              <a
                href="https://huggingface.co/ggerganov/whisper.cpp/tree/main"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                HuggingFace
              </a>
              {' '}and place them in the models folder.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
