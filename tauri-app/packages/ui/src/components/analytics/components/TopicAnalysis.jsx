import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { BarChart3 } from 'lucide-react'
import { formatPercentage, getSentimentColor, getSentimentIcon } from '../utils/formatters'

export default function TopicAnalysis({ analytics, selectedSpeakerId }) {
  if (!analytics || analytics.topics.length === 0) return null

  const selectedSpeakerInfo = analytics.speakers.find(s => s.id === selectedSpeakerId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Topic Analysis
          {selectedSpeakerId !== 'all' && (
            <Badge variant="outline" className="ml-2">
              {selectedSpeakerInfo?.name}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Key topics discussed and their sentiment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {analytics.topics.map((topic, index) => (
            <div key={topic.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{topic.name}</span>
                  <Badge variant="outline">{topic.frequency} mentions</Badge>
                  <div className="flex items-center gap-1">
                    {getSentimentIcon(topic.sentiment)}
                    <span className={`text-xs ${getSentimentColor(topic.sentiment)}`}>
                      {formatPercentage(topic.sentiment * 100)}
                    </span>
                  </div>
                </div>
              </div>
              <Progress value={(topic.frequency / Math.max(...analytics.topics.map(t => t.frequency))) * 100} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}