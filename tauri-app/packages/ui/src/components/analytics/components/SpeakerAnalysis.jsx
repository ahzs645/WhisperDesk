import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, UserCheck } from 'lucide-react'
import { formatTime, formatPercentage } from '../utils/formatters'
import { getSpeakerColor } from '../utils/colors'

export default function SpeakerAnalysis({ 
  analytics, 
  selectedSpeakerId, 
  onSpeakerSelection 
}) {
  if (!analytics) return null

  const selectedSpeakerInfo = analytics.speakers.find(s => s.id === selectedSpeakerId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Speaker Analysis
          {selectedSpeakerId !== 'all' && (
            <Badge variant="secondary" className="ml-2">
              <UserCheck className="w-3 h-3 mr-1" />
              {selectedSpeakerInfo?.name}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {selectedSpeakerId === 'all' 
            ? 'Speaking time, turns, and conversation dominance. Click a speaker to filter all analytics.'
            : `Detailed statistics for ${selectedSpeakerInfo?.name || 'selected speaker'}`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* All Speakers option */}
          <div 
            className={`space-y-2 p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50 ${
              selectedSpeakerId === 'all' 
                ? 'bg-primary/10 border-primary/50 ring-2 ring-primary/20' 
                : 'border-border'
            }`}
            onClick={() => onSpeakerSelection('all')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                    ALL
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">All Speakers</p>
                  <p className="text-xs text-muted-foreground">
                    Combined analysis
                  </p>
                </div>
              </div>
              {selectedSpeakerId === 'all' && (
                <Badge variant="default" className="text-xs">
                  <UserCheck className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              )}
            </div>
          </div>

          {/* Individual speakers */}
          {analytics.speakers.map((speaker, index) => {
            const isSelected = selectedSpeakerId === speaker.id
            const speakerColor = getSpeakerColor(speaker.id, index)
            
            return (
              <div 
                key={speaker.id} 
                className={`space-y-2 p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50 ${
                  isSelected 
                    ? 'bg-primary/10 border-primary/50 ring-2 ring-primary/20' 
                    : 'border-border'
                }`}
                onClick={() => onSpeakerSelection(speaker.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className={`text-xs ${speakerColor}`}>
                        {speaker.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{speaker.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(speaker.speakingTime)} • {speaker.turns} turns
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={speakerColor}>
                      {formatPercentage(speaker.dominance)}
                    </Badge>
                    {isSelected && (
                      <Badge variant="default" className="text-xs">
                        <UserCheck className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                </div>
                <Progress value={speaker.dominance} className="h-2" />
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}