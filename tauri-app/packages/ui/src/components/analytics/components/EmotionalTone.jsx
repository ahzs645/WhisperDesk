import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PieChart, Pie, Cell } from 'recharts'
import { Brain } from 'lucide-react'

export default function EmotionalTone({ analytics, selectedSpeakerId }) {
  if (!analytics) return null

  const selectedSpeakerInfo = analytics.speakers.find(s => s.id === selectedSpeakerId)

  const chartConfig = {
    emotions: {
      label: "Emotions",
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Emotional Tone
          {selectedSpeakerId !== 'all' && (
            <Badge variant="outline" className="ml-2">
              {selectedSpeakerInfo?.name}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Distribution of emotional states detected
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ChartContainer 
            config={chartConfig} 
            className="h-full w-full [&>.recharts-wrapper]:!h-full [&>.recharts-wrapper]:!w-full"
          >
            <PieChart>
              <Pie
                data={analytics.emotions}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {analytics.emotions.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    formatter={(value) => [`${value}%`]}
                  />
                }
              />
            </PieChart>
          </ChartContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
          {analytics.emotions.map((emotion, index) => (
            <div key={emotion.name} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: emotion.color }}
              />
              <span>{emotion.name}</span>
              <span className="font-medium ml-auto">{emotion.value}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}