import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mic } from 'lucide-react'

export default function SpeechPatterns({ analytics, selectedSpeakerId }) {
  if (!analytics) return null

  const selectedSpeakerInfo = analytics.speakers.find(s => s.id === selectedSpeakerId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Speech Patterns
          {selectedSpeakerId !== 'all' && (
            <Badge variant="outline" className="ml-2">
              {selectedSpeakerInfo?.name}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Fluency, pauses, and speaking characteristics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Fillers (um, uh)</span>
              <Badge variant="outline">{analytics.speechPattern.fillers.count}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Filler Rate</span>
              <span className="text-sm font-medium">{analytics.speechPattern.fillers.rate}/min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Interruptions</span>
              <Badge variant="outline">{analytics.speechPattern.interruptions}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Overlaps</span>
              <Badge variant="outline">{analytics.speechPattern.overlaps}</Badge>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Total Pauses</span>
              <Badge variant="outline">{analytics.speechPattern.pauses.totalCount}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Avg Pause</span>
              <span className="text-sm font-medium">{analytics.speechPattern.pauses.avgDuration}s</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Longest Pause</span>
              <span className="text-sm font-medium">{analytics.speechPattern.pauses.longestPause}s</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">RTF</span>
              <span className="text-sm font-medium">{analytics.qualityMetrics.rtf}×</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}