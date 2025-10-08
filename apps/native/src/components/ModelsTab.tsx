import React, { useState, useEffect } from 'react'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Progress } from '@repo/ui/components/progress'
import { Users, CheckCircle2, Download } from 'lucide-react'
import { toast } from 'sonner'
import {
  getModelsFolder,
  downloadModel,
  onDownloadProgress,
} from '../lib/tauri-bindings'
import { invoke } from '@tauri-apps/api/core'
import { ModelMarketplace } from './ModelMarketplace'

const DIARIZATION_MODEL_URLS = {
  'segmentation': 'https://github.com/thewh1teagle/vibe/releases/download/v0.0.1/segmentation-3.0.onnx',
  'embedding': 'https://github.com/thewh1teagle/vibe/releases/download/v0.0.1/wespeaker_en_voxceleb_CAM++.onnx',
}

export function ModelsTab() {
  const [modelsFolder, setModelsFolder] = useState<string>('')
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [hasDiarizationModels, setHasDiarizationModels] = useState({
    segmentation: false,
    embedding: false,
  })

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

  const checkDiarizationModels = async (folder: string) => {
    try {
      // Check if diarization model files exist in the folder
      const segmentationExists = await invoke<boolean>('file_exists', {
        path: `${folder}/segmentation-3.0.onnx`
      })
      const embeddingExists = await invoke<boolean>('file_exists', {
        path: `${folder}/wespeaker_en_voxceleb_CAM++.onnx`
      })

      setHasDiarizationModels({
        segmentation: segmentationExists,
        embedding: embeddingExists,
      })
    } catch (error) {
      console.error('Failed to check diarization models:', error)
    }
  }

  const loadModelsData = async () => {
    try {
      const folder = await getModelsFolder()
      setModelsFolder(folder)

      // Check for diarization models using file_exists
      await checkDiarizationModels(folder)
    } catch (error) {
      console.error('Failed to load models:', error)
      toast.error('Failed to load models list')
    }
  }

  const handleDownloadDiarizationModel = async (url?: string) => {
    if (!url) {
      toast.error('Invalid model URL')
      return
    }

    setIsDownloading(true)
    setDownloadProgress(0)
    toast.info('Downloading diarization model...')

    try {
      const urlObj = new URL(url)
      const filename = urlObj.pathname.split('/').pop() || 'model.onnx'
      const modelPath = `${modelsFolder}/${filename}`

      await downloadModel(url, modelPath)

      setDownloadProgress(0)
      toast.success('Diarization model downloaded successfully!')
      await loadModelsData()
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download model: ' + String(error))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Whisper Model Marketplace */}
      <ModelMarketplace />

      {/* Diarization Models Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Speaker Diarization Models
          </CardTitle>
          <CardDescription>
            Required for speaker identification feature
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(DIARIZATION_MODEL_URLS).map(([name, url]) => {
              const isDownloaded = hasDiarizationModels[name as keyof typeof hasDiarizationModels]
              return (
                <Button
                  key={name}
                  variant={isDownloaded ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleDownloadDiarizationModel(url)}
                  disabled={isDownloading || isDownloaded}
                  className="capitalize"
                >
                  {isDownloaded ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {name} ✓
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      {name}
                    </>
                  )}
                </Button>
              )
            })}
          </div>

          {hasDiarizationModels.segmentation && hasDiarizationModels.embedding && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              ✓ All diarization models are installed
            </p>
          )}

          {/* Download Progress */}
          {isDownloading && (
            <div className="space-y-2 mt-4">
              <Progress value={downloadProgress} />
              <p className="text-xs text-muted-foreground text-center">
                Downloading... {Math.round(downloadProgress)}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
