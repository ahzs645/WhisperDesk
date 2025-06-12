import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, FileAudio, FileUp, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

export function FileUploadSection({ selectedFile, onFileSelect, onFileChange }) {
  const [dragOver, setDragOver] = useState(false)
  const [windowDragOver, setWindowDragOver] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)

  // Handle window-wide drag events
  useEffect(() => {
    const handleWindowDragEnter = (e) => {
      e.preventDefault()
      setDragCounter(prev => prev + 1)
      
      // Check if the dragged item contains files
      if (e.dataTransfer.types.includes('Files')) {
        setWindowDragOver(true)
      }
    }

    const handleWindowDragLeave = (e) => {
      e.preventDefault()
      setDragCounter(prev => {
        const newCounter = prev - 1
        if (newCounter <= 0) {
          setWindowDragOver(false)
          return 0
        }
        return newCounter
      })
    }

    const handleWindowDragOver = (e) => {
      e.preventDefault()
      if (e.dataTransfer.types.includes('Files')) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleWindowDrop = (e) => {
      e.preventDefault()
      setWindowDragOver(false)
      setDragCounter(0)
      
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        handleFileDrop(files[0])
      }
    }

    // Add event listeners to window
    window.addEventListener('dragenter', handleWindowDragEnter)
    window.addEventListener('dragleave', handleWindowDragLeave)
    window.addEventListener('dragover', handleWindowDragOver)
    window.addEventListener('drop', handleWindowDrop)

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter)
      window.removeEventListener('dragleave', handleWindowDragLeave)
      window.removeEventListener('dragover', handleWindowDragOver)
      window.removeEventListener('drop', handleWindowDrop)
    }
  }, [])

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

  const handleFileDrop = (file) => {
    const fileInfo = {
      path: file.path,
      name: file.name,
      size: file.size
    }

    onFileChange(fileInfo)
    toast.success(`📁 File selected: ${file.name}`)
  }

  const handleLocalDrop = (e) => {
    e.preventDefault()
    setDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileDrop(files[0])
    }
  }

  const handleLocalDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const handleLocalDragLeave = () => {
    setDragOver(false)
  }

  return (
    <>
      {/* Full Window Glass Overlay */}
      {windowDragOver && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          {/* Glass backdrop */}
          <div className="absolute inset-0 bg-black/20 backdrop-blur-md animate-in fade-in duration-300">
            {/* Animated glow border */}
            <div className="absolute inset-4 rounded-2xl border-4 border-primary/50 bg-gradient-to-br from-primary/20 via-transparent to-primary/20 shadow-2xl">
              {/* Animated glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-pulse">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/20 via-purple-400/20 to-pink-400/20 animate-pulse" />
              </div>
              
              {/* Central content */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4 text-white">
                  <div className="relative">
                    <Upload className="w-24 h-24 mx-auto animate-bounce" />
                    <Sparkles className="w-8 h-8 absolute -top-2 -right-2 animate-spin text-yellow-400" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                      Drop Your File
                    </h2>
                    <p className="text-xl text-white/80">
                      Release to upload and transcribe
                    </p>
                    <p className="text-sm text-white/60">
                      Supports audio and video files
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Corner glow effects */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-blue-400/30 rounded-full blur-3xl animate-pulse" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-400/30 rounded-full blur-3xl animate-pulse delay-300" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-400/30 rounded-full blur-3xl animate-pulse delay-700" />
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-cyan-400/30 rounded-full blur-3xl animate-pulse delay-500" />
            </div>
          </div>
        </div>
      )}

      {/* Original File Upload Card */}
      <Card className="relative overflow-hidden">
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
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-300 ${
              dragOver 
                ? 'border-primary bg-primary/10 scale-105 shadow-lg' 
                : windowDragOver
                ? 'border-primary/50 bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragOver={handleLocalDragOver}
            onDragLeave={handleLocalDragLeave}
            onDrop={handleLocalDrop}
            onClick={handleFileSelect}
          >
            <div className="space-y-2">
              <div className={`transition-transform duration-300 ${dragOver ? 'scale-110' : ''}`}>
                <Upload className={`w-8 h-8 mx-auto transition-colors duration-300 ${
                  dragOver ? 'text-primary' : 'text-muted-foreground'
                }`} />
              </div>
              <div className="text-sm text-muted-foreground">
                {windowDragOver 
                  ? 'Drop anywhere on the window!' 
                  : 'Drag and drop your file here, or click to browse'
                }
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
    </>
  )
}