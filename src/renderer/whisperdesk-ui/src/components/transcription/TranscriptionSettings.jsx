import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Settings, RefreshCw } from 'lucide-react'

export function TranscriptionSettings({ 
  providers = [],
  models = [],
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  onRefreshProviders,
  onRefreshModels,
  isLoading = false
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Transcription Settings</span>
            </CardTitle>
            <CardDescription>
              Configure provider, model, and transcription options
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefreshProviders}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Providers
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefreshModels}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Models
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Transcription Provider</Label>
            <Select
              id="provider"
              value={selectedProvider}
              onValueChange={onProviderChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem 
                    key={provider.id} 
                    value={provider.id}
                    disabled={!provider.isAvailable}
                  >
                    <div className="flex items-center space-x-2">
                      <span>{provider.name}</span>
                      {!provider.isAvailable && (
                        <Badge variant="destructive" className="text-xs">
                          Unavailable
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {providers.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No providers available. Check your configuration.
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select
              id="model"
              value={selectedModel}
              onValueChange={onModelChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center space-x-2">
                      <span>{model.name}</span>
                      {model.size && (
                        <Badge variant="outline" className="text-xs">
                          {typeof model.size === 'number' 
                            ? `${(model.size / 1024 / 1024).toFixed(0)}MB`
                            : model.size
                          }
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {models.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No models installed. Visit the Models tab to download.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}