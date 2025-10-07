import React, { useState, useEffect } from 'react'
import { Button } from '@repo/ui/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Badge } from '@repo/ui/components/ui/badge'
import { Progress } from '@repo/ui/components/ui/progress'
import { Download, Trash2, CheckCircle, Package } from 'lucide-react'
import { toast } from 'sonner'
import { invoke } from '@repo/ui/lib/mock-tauri-api'

interface Model {
  name: string
  size: string
  downloaded: boolean
  downloadProgress?: number
  description: string
}

export function ModelsTab() {
  const [models, setModels] = useState<Model[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      const result = await invoke('list_models')
      setModels(result)
    } catch (error) {
      toast.error('Failed to load models')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async (modelName: string) => {
    toast.info(`Downloading ${modelName}...`)

    try {
      await invoke('download_model', { modelName })
      toast.success(`${modelName} downloaded!`)
      await loadModels()
    } catch (error) {
      toast.error(`Failed to download ${modelName}`)
    }
  }

  const handleDelete = async (modelName: string) => {
    try {
      await invoke('delete_model', { modelName })
      toast.success(`${modelName} deleted`)
      await loadModels()
    } catch (error) {
      toast.error(`Failed to delete ${modelName}`)
    }
  }

  if (isLoading) {
    return <div>Loading models...</div>
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
            Manage AI models for transcription. Larger models are more accurate but slower.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map((model) => (
          <Card key={model.name} className={model.downloaded ? 'border-primary' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="capitalize flex items-center gap-2">
                    {model.name}
                    {model.downloaded && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </CardTitle>
                  <CardDescription>{model.description}</CardDescription>
                </div>
                <Badge variant={model.downloaded ? 'default' : 'outline'}>
                  {model.size}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {model.downloadProgress !== undefined && (
                <div className="space-y-1">
                  <Progress value={model.downloadProgress} />
                  <p className="text-xs text-muted-foreground">
                    Downloading... {model.downloadProgress}%
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                {model.downloaded ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.success(`Using ${model.name}`)}
                      className="flex-1"
                    >
                      Use Model
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(model.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleDownload(model.name)}
                    className="w-full"
                    disabled={model.downloadProgress !== undefined}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
