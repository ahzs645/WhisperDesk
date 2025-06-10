import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, FileAudio, FileUp } from 'lucide-react'
import { toast } from 'sonner'

export function FileUploadSection({ selectedFile, onFileSelect, onFileChange }) {
  const [dragOver, setDragOver] = useState(false)

  const handleFileSelect = async () => {
    if (!window.electronAPI?.file?.showOpenDialog) {
      toast.error('File API not available')
      return
    }

    try {
      const result = await window.electronAPI.file.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'] },
          { name: 'Video Files', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]
        const fileInfo = {
          path: filePath,
          name: filePath.split('/').pop() || filePath.split('\\').pop(),
          size: 0
        }
        
        onFileChange(fileInfo)
        toast.success(`📁 File selected: ${fileInfo.name}`)
      }
    } catch (error) {
      console.error('File selection failed:', error)
      toast.error('Failed to select file: ' + error.message)
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const file = files[0]
    const fileInfo = {
      path: file.path,
      name: file.name,
      size: file.size
    }

    onFileChange(fileInfo)
    toast.success(`📁 File selected: ${file.name}`)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileUp className="w-5 h-5" />
          <span>File Upload</span>
          {selectedFile && (
            <Badge variant="secondary" className="ml-2">
              <FileAudio className="w-3 h-3 mr-1" />
              Selected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Upload an audio or video file for transcription
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleFileSelect}
        >
          <div className="space-y-2">
            <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              Drag and drop your file here, or click to browse
            </div>
            <div className="text-xs text-muted-foreground">
              Supports: MP3, WAV, MP4, AVI, MOV, and more
            </div>
            {selectedFile && (
              <div className="mt-2 p-2 bg-muted rounded text-sm">
                <strong>Selected:</strong> {selectedFile.name}
                {selectedFile.size > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}