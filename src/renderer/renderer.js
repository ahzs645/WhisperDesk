const { ipcRenderer } = require('electron');

// UI Elements
const startButton = document.getElementById('startRecording');
const stopButton = document.getElementById('stopRecording');
const audioSource = document.getElementById('audioSource');
const modelSize = document.getElementById('modelSize');
const transcriptionDiv = document.getElementById('transcription');
const audioCanvas = document.getElementById('audioCanvas');
const ctx = audioCanvas.getContext('2d');

// Audio visualization setup
let audioContext;
let analyser;
let dataArray;
let animationId;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

function setupAudioVisualization() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    // Set canvas size
    audioCanvas.width = audioCanvas.offsetWidth;
    audioCanvas.height = audioCanvas.offsetHeight;
}

function drawAudioVisualization() {
    animationId = requestAnimationFrame(drawAudioVisualization);
    analyser.getByteTimeDomainData(dataArray);
    
    ctx.fillStyle = 'rgb(200, 200, 200)';
    ctx.fillRect(0, 0, audioCanvas.width, audioCanvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgb(0, 0, 0)';
    ctx.beginPath();
    
    const sliceWidth = audioCanvas.width * 1.0 / dataArray.length;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * audioCanvas.height / 2;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
    }
    
    ctx.lineTo(audioCanvas.width, audioCanvas.height / 2);
    ctx.stroke();
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
                
                // Process the chunk for transcription
                const audioBlob = new Blob([event.data], { type: 'audio/wav' });
                const arrayBuffer = await audioBlob.arrayBuffer();
                
                const result = await ipcRenderer.invoke('process-audio-chunk', {
                    audioData: arrayBuffer,
                    options: {
                        language: 'en',
                        word_timestamps: true
                    }
                });
                
                if (result.success) {
                    ipcRenderer.send('transcription-update', {
                        text: result.result.text,
                        speaker: null // TODO: Implement speaker diarization
                    });
                }
            }
        };
        
        mediaRecorder.start(5000); // Process chunks every 5 seconds
        isRecording = true;
    } catch (error) {
        console.error('Error starting recording:', error);
    }
}

async function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        
        // Stop all tracks
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        
        // Process any remaining audio
        if (audioChunks.length > 0) {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            const result = await ipcRenderer.invoke('process-audio-chunk', {
                audioData: arrayBuffer,
                options: {
                    language: 'en',
                    word_timestamps: true
                }
            });
            
            if (result.success) {
                ipcRenderer.send('transcription-update', {
                    text: result.result.text,
                    speaker: null
                });
            }
        }
    }
}

// Event Handlers
startButton.addEventListener('click', async () => {
    try {
        const options = {
            source: audioSource.value,
            modelSize: modelSize.value
        };
        
        const initResult = await ipcRenderer.invoke('start-transcription', options);
        if (!initResult.success) {
            throw new Error(initResult.error);
        }
        
        await startRecording();
        setupAudioVisualization();
        drawAudioVisualization();
        
        startButton.disabled = true;
        stopButton.disabled = false;
    } catch (error) {
        console.error('Error starting recording:', error);
    }
});

stopButton.addEventListener('click', async () => {
    try {
        await stopRecording();
        await ipcRenderer.invoke('stop-transcription');
        
        cancelAnimationFrame(animationId);
        
        startButton.disabled = false;
        stopButton.disabled = true;
    } catch (error) {
        console.error('Error stopping recording:', error);
    }
});

// IPC Event Listeners
ipcRenderer.on('transcription-update', (event, data) => {
    const { text, speaker } = data;
    const speakerLabel = speaker ? `<span class="speaker">Speaker ${speaker}:</span> ` : '';
    transcriptionDiv.innerHTML += `<p>${speakerLabel}${text}</p>`;
    transcriptionDiv.scrollTop = transcriptionDiv.scrollHeight;
}); 