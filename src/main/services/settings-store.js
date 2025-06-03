const Store = require('electron-store');

class SettingsStore {
    constructor() {
        this.store = new Store({
            name: 'settings',
            defaults: {
                recordingDirectory: null,
                includeMicrophone: true,
                includeSystemAudio: true
            }
        });
    }

    getRecordingDirectory() {
        return this.store.get('recordingDirectory');
    }

    setRecordingDirectory(directory) {
        this.store.set('recordingDirectory', directory);
    }

    getIncludeMicrophone() {
        return this.store.get('includeMicrophone');
    }

    setIncludeMicrophone(value) {
        this.store.set('includeMicrophone', value);
    }

    getIncludeSystemAudio() {
        return this.store.get('includeSystemAudio');
    }

    setIncludeSystemAudio(value) {
        this.store.set('includeSystemAudio', value);
    }

    getAllSettings() {
        return {
            recordingDirectory: this.getRecordingDirectory(),
            includeMicrophone: this.getIncludeMicrophone(),
            includeSystemAudio: this.getIncludeSystemAudio()
        };
    }
}

module.exports = SettingsStore; 