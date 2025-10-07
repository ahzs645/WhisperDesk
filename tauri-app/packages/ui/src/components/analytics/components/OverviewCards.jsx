import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Clock, MessageSquare, Users, Target, Timer, AlertTriangle } from 'lucide-react'
import { formatTime, formatPercentage } from '../utils/formatters'

export default function OverviewCards({ analytics }) {
  if (!analytics) return null

  const cards = [
    {
      icon: Clock,
      label: 'Duration',
      value: formatTime(analytics.overview.duration)
    },
    {
      icon: MessageSquare,
      label: 'Words',
      value: analytics.overview.wordCount.toLocaleString()
    },
    {
      icon: Users,
      label: 'Speakers',
      value: analytics.overview.speakerCount
    },
    {
      icon: Target,
      label: 'Confidence',
      value: formatPercentage(analytics.overview.confidence)
    },
    {
      icon: Timer,
      label: 'WPM',
      value: analytics.overview.wpm
    },
    {
      icon: AlertTriangle,
      label: 'WER',
      value: formatPercentage(analytics.overview.wer * 100)
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">{card.label}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}