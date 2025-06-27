import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { AreaChart, Area, XAxis, YAxis } from 'recharts'
import { Heart, ThumbsUp, ThumbsDown, Meh } from 'lucide-react'
import { formatTime, formatPercentage, getSentimentColor, getSentimentIcon } from '../utils/formatters'

export default function SentimentAnalysis({ analytics, selectedSpeakerId }) {
  if (!analytics) return null

  const selectedSpeakerInfo = analytics.speakers.find(s => s.id === selectedSpeakerId)

  // Dynamic color based on overall sentiment
  const isPositive = analytics.sentiment.overall >= 0.5
  const sentimentColor = isPositive ? "#10b981" : "#ef4444" // Green for positive, red for negative

  const chartConfig = {
    sentiment: {
      label: "Sentiment",
      color: sentimentColor,
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5" />
          Sentiment Analysis
          {selectedSpeakerId !== 'all' && (
            <Badge variant="outline" className="ml-2">
              {selectedSpeakerInfo?.name}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Emotional tone throughout the conversation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Sentiment</span>
            <div className="flex items-center gap-1">
              {getSentimentIcon(analytics.sentiment.overall)}
              <span className={`font-medium ${getSentimentColor(analytics.sentiment.overall)}`}>
                {formatPercentage(analytics.sentiment.overall * 100)}
              </span>
            </div>
          </div>
          
          <div className="h-32">
            <ChartContainer 
              config={chartConfig} 
              className="h-full w-full [&>.recharts-wrapper]:!h-full [&>.recharts-wrapper]:!w-full"
            >
              <AreaChart data={analytics.sentiment.byTime}>
                <defs>
                  <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={sentimentColor} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={sentimentColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="sentiment" 
                  stroke={sentimentColor} 
                  fillOpacity={1} 
                  fill="url(#sentimentGradient)" 
                />
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 1]} hide />
                <ChartTooltip 
                  content={
                    <ChartTooltipContent 
                      formatter={(value) => [formatPercentage(value * 100)]}
                      labelFormatter={(time) => `${formatTime(time)}`}
                    />
                  }
                />
              </AreaChart>
            </ChartContainer>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
                <ThumbsUp className="w-3 h-3" />
                <span className="font-medium">{analytics.sentiment.distribution.positive}%</span>
              </div>
              <p className="text-muted-foreground">Positive</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400">
                <Meh className="w-3 h-3" />
                <span className="font-medium">{analytics.sentiment.distribution.neutral}%</span>
              </div>
              <p className="text-muted-foreground">Neutral</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                <ThumbsDown className="w-3 h-3" />
                <span className="font-medium">{analytics.sentiment.distribution.negative}%</span>
              </div>
              <p className="text-muted-foreground">Negative</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}