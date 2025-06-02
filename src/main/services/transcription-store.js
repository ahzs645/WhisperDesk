const Store = require('electron-store')

class TranscriptionStore {
  constructor() {
    this.store = new Store({
      name: 'transcription-state',
      defaults: {
        activeTranscription: null
      }
    })
  }

  getActiveTranscription() {
    return this.store.get('activeTranscription')
  }

  setActiveTranscription(transcription) {
    this.store.set('activeTranscription', transcription)
  }

  updateActiveTranscription(updates) {
    const current = this.getActiveTranscription()
    if (current && current.id === updates.id) {
      this.store.set('activeTranscription', {
        ...current,
        ...updates
      })
    }
  }

  clearActiveTranscription() {
    this.store.delete('activeTranscription')
  }
}

module.exports = new TranscriptionStore() 