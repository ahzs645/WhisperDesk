import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Eye } from 'lucide-react'
import { formatPercentage } from '../utils/formatters'

export default function QualityMetrics({ analytics, selectedSpeakerId }) {
  if (!analytics) return null

  const selectedSpeakerInfo = analytics.speakers.find(s => s.id === selectedSpeakerId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Transcription Quality
          {selectedSpeakerId !== 'all' && (
            <Badge variant="outline" className="ml-2">
              {selectedSpeakerInfo?.name}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Confidence distribution and accuracy metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {analytics.qualityMetrics.confidence.map((conf, index) => (
              <div key={conf.range} className="text-center">
                <div className="text-2xl font-bold">{conf.count}</div>
                <div className="text-sm text-muted-foreground">words</div>
                <div className="text-xs text-muted-foreground">{conf.range}</div>
                <Progress value={conf.percentage} className="h-1 mt-2" />
              </div>
            ))}
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-muted-foreground">Word Error Rate</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {formatPercentage(analytics.overview.wer * 100)}
              </div>
              <div className="text-xs text-muted-foreground">Excellent</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Real-time Factor</div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {analytics.qualityMetrics.rtf}×
              </div>
              <div className="text-xs text-muted-foreground">Fast</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Voice Quality</div>
              <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {formatPercentage(analytics.acoustic.voiceQuality * 100)}
              </div>
              <div className="text-xs text-muted-foreground">High</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 