// src/main/services/diarization-models-config.js
const DIARIZATION_MODELS = [
  {
    id: 'pyannote-segmentation-3.0',
    name: 'Pyannote Segmentation 3.0',
    type: 'segmentation',
    size: '17.4 MB',
    sizeBytes: 17400000,
    description: 'Speaker change detection model',
    downloadUrl: 'https://huggingface.co/pyannote/segmentation-3.0/resolve/main/pytorch_model.bin',
    onnxUrl: 'https://huggingface.co/WhisperDesk/pyannote-onnx/resolve/main/segmentation-3.0.onnx',
    expectedFilename: 'segmentation-3.0.onnx',
    required: true
  },
  {
    id: 'pyannote-embedding-1.0',
    name: 'Pyannote Embedding 1.0', 
    type: 'embedding',
    size: '6.8 MB',
    sizeBytes: 6800000,
    description: 'Speaker embedding extraction model',
    downloadUrl: 'https://huggingface.co/pyannote/embedding/resolve/main/pytorch_model.bin',
    onnxUrl: 'https://huggingface.co/WhisperDesk/pyannote-onnx/resolve/main/embedding-1.0.onnx',
    expectedFilename: 'embedding-1.0.onnx',
    required: true
  }
];