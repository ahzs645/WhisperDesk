import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Mic, Package, Clock, Settings } from 'lucide-react'
import { ModelMarketplace } from '@/components/ModelMarketplace-WebCompatible'
import { TranscriptionTab } from '@/components/TranscriptionTab-WebCompatible'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('transcribe')

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mic className="w-8 h-8 text-primary" />
              <h1 className="text-xl font-bold">WhisperDesk Enhanced</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="transcribe" className="flex items-center space-x-2">
              <Mic className="w-4 h-4" />
              <span>Transcribe</span>
            </TabsTrigger>
            <TabsTrigger value="models" className="flex items-center space-x-2">
              <Package className="w-4 h-4" />
              <span>Models</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>History</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Transcription Tab */}
          <TabsContent value="transcribe" className="space-y-6">
            <TranscriptionTab />
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="space-y-6">
            <ModelMarketplace />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Transcription History</CardTitle>
                <CardDescription>
                  View your past transcriptions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>No transcriptions yet</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>
                  Configure your preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>Settings panel coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default App

