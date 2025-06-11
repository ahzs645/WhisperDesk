const fs = require('fs').promises;
const path = require('path');
const { clipboard } = require('electron');

class ExportService {
  constructor() {
    this.supportedFormats = {
      text: ['txt', 'md'],
      subtitle: ['srt', 'vtt', 'ass'],
      data: ['json', 'csv', 'xml']
    };
  }

  async initialize() {
    // No initialization needed for export service
    console.log('Export service initialized');
  }

  async exportText(transcriptionData, format, options = {}) {
    try {
      let content = '';
      
      switch (format.toLowerCase()) {
        case 'txt':
          content = this.generatePlainText(transcriptionData, options);
          break;
        case 'md':
          content = this.generateMarkdown(transcriptionData, options);
          break;
        case 'json':
          content = this.generateJSON(transcriptionData, options);
          break;
        case 'csv':
          content = this.generateCSV(transcriptionData, options);
          break;
        case 'xml':
          content = this.generateXML(transcriptionData, options);
          break;
        default:
          throw new Error(`Unsupported text format: ${format}`);
      }

      return {
        success: true,
        content,
        mimeType: this.getMimeType(format)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async exportSubtitle(transcriptionData, format, options = {}) {
    try {
      let content = '';
      
      switch (format.toLowerCase()) {
        case 'srt':
          content = this.generateSRT(transcriptionData, options);
          break;
        case 'vtt':
          content = this.generateVTT(transcriptionData, options);
          break;
        case 'ass':
          content = this.generateASS(transcriptionData, options);
          break;
        default:
          throw new Error(`Unsupported subtitle format: ${format}`);
      }

      return {
        success: true,
        content,
        mimeType: this.getMimeType(format)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async exportEnhancedTranscription(transcriptionData, format, options = {}) {
    try {
      let content = '';
      
      switch (format.toLowerCase()) {
        case 'enhanced-json':
          content = this.generateEnhancedJSON(transcriptionData, options);
          break;
        case 'enhanced-txt':
          content = this.generateEnhancedText(transcriptionData, options);
          break;
        case 'speakers-csv':
          content = this.generateSpeakersCSV(transcriptionData, options);
          break;
        case 'segments-csv':
          content = this.generateSegmentsCSV(transcriptionData, options);
          break;
        default:
          // Fall back to existing export methods
          return this.exportText(transcriptionData, format, options);
      }

      return {
        success: true,
        content,
        mimeType: this.getMimeType(format)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  generatePlainText(data, options = {}) {
    const { includeTimestamps = false, includeSpeakers = true, includeConfidence = false } = options;
    let text = '';

    if (data.title) {
      text += `${data.title}\\n`;
      text += '='.repeat(data.title.length) + '\\n\\n';
    }

    if (data.metadata) {
      text += `Generated: ${new Date(data.metadata.createdAt).toLocaleString()}\\n`;
      text += `Duration: ${this.formatDuration(data.metadata.duration)}\\n`;
      if (data.metadata.model) {
        text += `Model: ${data.metadata.model}\\n`;
      }
      text += '\\n';
    }

    data.segments.forEach((segment, index) => {
      let line = '';

      if (includeTimestamps) {
        line += `[${this.formatTimestamp(segment.start)} --> ${this.formatTimestamp(segment.end)}] `;
      }

      if (includeSpeakers && segment.speaker) {
        line += `${segment.speaker}: `;
      }

      line += segment.text;

      if (includeConfidence && segment.confidence) {
        line += ` (${Math.round(segment.confidence * 100)}%)`;
      }

      text += line + '\\n';
    });

    return text;
  }

  generateMarkdown(data, options = {}) {
    const { includeTimestamps = false, includeSpeakers = true } = options;
    let markdown = '';

    if (data.title) {
      markdown += `# ${data.title}\\n\\n`;
    }

    if (data.metadata) {
      markdown += '## Metadata\\n\\n';
      markdown += `- **Generated:** ${new Date(data.metadata.createdAt).toLocaleString()}\\n`;
      markdown += `- **Duration:** ${this.formatDuration(data.metadata.duration)}\\n`;
      if (data.metadata.model) {
        markdown += `- **Model:** ${data.metadata.model}\\n`;
      }
      markdown += '\\n';
    }

    markdown += '## Transcription\\n\\n';

    data.segments.forEach((segment, index) => {
      if (includeSpeakers && segment.speaker) {
        markdown += `**${segment.speaker}:** `;
      }

      if (includeTimestamps) {
        markdown += `*[${this.formatTimestamp(segment.start)}]* `;
      }

      markdown += segment.text + '\\n\\n';
    });

    return markdown;
  }

  generateJSON(data, options = {}) {
    const exportData = {
      ...data,
      exportedAt: new Date().toISOString(),
      exportOptions: options
    };

    return JSON.stringify(exportData, null, 2);
  }

  generateCSV(data, options = {}) {
    const { includeSpeakers = true, includeConfidence = false } = options;
    let csv = '';

    // Header
    const headers = ['Start', 'End', 'Duration'];
    if (includeSpeakers) headers.push('Speaker');
    headers.push('Text');
    if (includeConfidence) headers.push('Confidence');
    
    csv += headers.join(',') + '\\n';

    // Data rows
    data.segments.forEach(segment => {
      const row = [
        segment.start,
        segment.end,
        segment.end - segment.start
      ];

      if (includeSpeakers) {
        row.push(segment.speaker || '');
      }

      row.push(`"${segment.text.replace(/"/g, '""')}"`);

      if (includeConfidence) {
        row.push(segment.confidence || '');
      }

      csv += row.join(',') + '\\n';
    });

    return csv;
  }

  generateXML(data, options = {}) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\\n';
    xml += '<transcription>\\n';

    if (data.metadata) {
      xml += '  <metadata>\\n';
      Object.entries(data.metadata).forEach(([key, value]) => {
        xml += `    <${key}>${this.escapeXML(value)}</${key}>\\n`;
      });
      xml += '  </metadata>\\n';
    }

    xml += '  <segments>\\n';
    data.segments.forEach((segment, index) => {
      xml += `    <segment id="${index + 1}">\\n`;
      xml += `      <start>${segment.start}</start>\\n`;
      xml += `      <end>${segment.end}</end>\\n`;
      if (segment.speaker) {
        xml += `      <speaker>${this.escapeXML(segment.speaker)}</speaker>\\n`;
      }
      xml += `      <text>${this.escapeXML(segment.text)}</text>\\n`;
      if (segment.confidence) {
        xml += `      <confidence>${segment.confidence}</confidence>\\n`;
      }
      xml += '    </segment>\\n';
    });
    xml += '  </segments>\\n';
    xml += '</transcription>';

    return xml;
  }

  generateSRT(data, options = {}) {
    let srt = '';
    
    data.segments.forEach((segment, index) => {
      srt += `${index + 1}\\n`;
      srt += `${this.formatSRTTimestamp(segment.start)} --> ${this.formatSRTTimestamp(segment.end)}\\n`;
      
      let text = segment.text;
      if (segment.speaker && options.includeSpeakers !== false) {
        text = `${segment.speaker}: ${text}`;
      }
      
      srt += `${text}\\n\\n`;
    });

    return srt.trim();
  }

  generateVTT(data, options = {}) {
    let vtt = 'WEBVTT\\n\\n';
    
    data.segments.forEach((segment, index) => {
      vtt += `${index + 1}\\n`;
      vtt += `${this.formatVTTTimestamp(segment.start)} --> ${this.formatVTTTimestamp(segment.end)}\\n`;
      
      let text = segment.text;
      if (segment.speaker && options.includeSpeakers !== false) {
        text = `<v ${segment.speaker}>${text}`;
      }
      
      vtt += `${text}\\n\\n`;
    });

    return vtt.trim();
  }

  generateASS(data, options = {}) {
    let ass = '[Script Info]\\n';
    ass += 'Title: WhisperDesk Transcription\\n';
    ass += 'ScriptType: v4.00+\\n\\n';
    
    ass += '[V4+ Styles]\\n';
    ass += 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\\n';
    ass += 'Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\\n\\n';
    
    ass += '[Events]\\n';
    ass += 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\\n';
    
    data.segments.forEach((segment, index) => {
      let text = segment.text;
      if (segment.speaker && options.includeSpeakers !== false) {
        text = `${segment.speaker}: ${text}`;
      }
      
      ass += `Dialogue: 0,${this.formatASSTimestamp(segment.start)},${this.formatASSTimestamp(segment.end)},Default,,0,0,0,,${text}\\n`;
    });

    return ass;
  }

  generateEnhancedJSON(data, options = {}) {
    const exportData = {
      ...data,
      exportedAt: new Date().toISOString(),
      exportOptions: options,
      format: 'enhanced-whisperdesk-v1'
    };

    return JSON.stringify(exportData, null, 2);
  }

  generateEnhancedText(data, options = {}) {
    const { includeSpeakers = true, includeTimestamps = true, includeMetadata = true } = options;
    let text = '';

    if (includeMetadata && data.metadata) {
      text += `Transcription Report\n`;
      text += `===================\n\n`;
      text += `Duration: ${this.formatDuration(data.metadata.duration)}\n`;
      text += `Model: ${data.metadata.model}\n`;
      text += `Provider: ${data.metadata.provider}\n`;
      text += `Language: ${data.metadata.language}\n`;
      text += `Created: ${new Date(data.metadata.createdAt).toLocaleString()}\n`;
      
      if (data.metadata.speakers && data.metadata.speakers.length > 0) {
        text += `\nSpeakers (${data.metadata.speakers.length}):\n`;
        data.metadata.speakers.forEach(speaker => {
          text += `  • ${speaker.label}: ${this.formatDuration(speaker.totalDuration)} (${speaker.segmentCount} segments)\n`;
          text += `    - Words: ${speaker.wordCount}\n`;
          text += `    - WPM: ${speaker.wpm}\n`;
          text += `    - Confidence: ${Math.round(speaker.averageConfidence * 100)}%\n`;
        });
      }
      
      text += '\n' + '='.repeat(50) + '\n\n';
    }

    if (data.segments && data.segments.length > 0) {
      data.segments.forEach(segment => {
        let line = '';

        if (includeTimestamps) {
          line += `[${this.formatTimestamp(segment.start)} → ${this.formatTimestamp(segment.end)}] `;
        }

        if (includeSpeakers && segment.speakerLabel) {
          line += `${segment.speakerLabel}: `;
        }

        line += segment.text;

        if (segment.confidence) {
          line += ` (${Math.round(segment.confidence * 100)}%)`;
        }

        text += line + '\n\n';
      });
    } else {
      text += data.text || 'No transcription content available.';
    }

    return text;
  }

  generateSpeakersCSV(data, options = {}) {
    if (!data.metadata?.speakers) {
      return 'Speaker ID,Speaker Label,Total Duration (seconds),Segment Count,Word Count,WPM,Average Confidence\nNo speaker data available';
    }

    const totalDuration = data.metadata.speakers.reduce((sum, s) => sum + s.totalDuration, 0);
    
    let csv = 'Speaker ID,Speaker Label,Total Duration (seconds),Segment Count,Word Count,WPM,Average Confidence\n';
    
    data.metadata.speakers.forEach(speaker => {
      const confidence = Math.round(speaker.averageConfidence * 100);
      csv += `"${speaker.id}","${speaker.label}",${speaker.totalDuration.toFixed(2)},${speaker.segmentCount},${speaker.wordCount},${speaker.wpm},${confidence}%\n`;
    });

    return csv;
  }

  generateSegmentsCSV(data, options = {}) {
    if (!data.segments || data.segments.length === 0) {
      return 'Segment ID,Start Time,End Time,Duration,Speaker ID,Speaker Label,Text,Confidence,Word Count\nNo segment data available';
    }

    let csv = 'Segment ID,Start Time,End Time,Duration,Speaker ID,Speaker Label,Text,Confidence,Word Count\n';
    
    data.segments.forEach(segment => {
      const duration = segment.end - segment.start;
      const wordCount = segment.text.split(/\s+/).filter(word => word.length > 0).length;
      const confidence = segment.confidence ? Math.round(segment.confidence * 100) : '';
      
      csv += `${segment.id},${segment.start},${segment.end},${duration.toFixed(2)},"${segment.speakerId || ''}","${segment.speakerLabel || ''}","${segment.text.replace(/"/g, '""')}",${confidence},${wordCount}\n`;
    });

    return csv;
  }

  async copyToClipboard(text) {
    try {
      clipboard.writeText(text);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveToFile(content, filePath) {
    try {
      await fs.writeFile(filePath, content, 'utf8');
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Utility methods
  formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  formatSRTTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  formatVTTTimestamp(seconds) {
    return this.formatTimestamp(seconds);
  }

  formatASSTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  escapeXML(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  getMimeType(format) {
    const mimeTypes = {
      txt: 'text/plain',
      md: 'text/markdown',
      json: 'application/json',
      csv: 'text/csv',
      xml: 'application/xml',
      srt: 'application/x-subrip',
      vtt: 'text/vtt',
      ass: 'text/x-ass'
    };

    return mimeTypes[format.toLowerCase()] || 'text/plain';
  }

  getSupportedFormats() {
    return this.supportedFormats;
  }
}

module.exports = ExportService;

