import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Video, Zap } from 'lucide-react'

export function QuickRecordSection({ onQuickRecordClick }) {
  const handleQuickRecord = () => {
    // FIXED: Use the passed click handler instead of auto-scrolling
    if (onQuickRecordClick) {
      onQuickRecordClick()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Video className="w-5 h-5" />
          <span>Quick Record</span>
          <Badge variant="outline" className="ml-2">
            <Zap className="w-3 h-3 mr-1" />
            Auto-transcribe
          </Badge>
        </CardTitle>
        <CardDescription>
          Record screen with audio and automatically transcribe
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground mb-3">
          Recording will automatically start transcription when complete.
          For advanced recording options, see the dedicated recording section below.
        </div>
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={handleQuickRecord}
        >
          <Video className="w-4 h-4 mr-2" />
          Use Enhanced Recorder
        </Button>
      </CardContent>
    </Card>
  )
}