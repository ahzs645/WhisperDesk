/**
 * @fileoverview File manager for screen recordings - handles file operations and storage
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

/**
 * File manager for screen recordings
 * Handles file operations, storage management, and cleanup
 */
class FileManager extends EventEmitter {
  constructor() {
    super();
    
    // Directory paths
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-recordings');
    this.defaultOutputDir = path.join(os.homedir(), 'Documents', 'WhisperDesk Recordings');
    
    // File tracking
    this.activeRecordings = new Map(); // Map of recording ID to file info
    this.completedRecordings = [];
    
    // Configuration
    this.config = {
      maxTempFiles: 50,
      maxFileAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      allowedExtensions: ['.webm', '.mp4', '.mov', '.avi'],
      maxFileSize: 5 * 1024 * 1024 * 1024 // 5GB
    };
  }

  /**
   * Initialize the file manager
   */
  async initialize() {
    try {
      console.log('🔧 Initializing Screen Recorder File Manager...');
      
      // Create directories
      await this.ensureDirectories();
      
      // Load existing recordings
      await this.loadExistingRecordings();
      
      // Clean up old files
      await this.cleanupOldFiles();
      
      console.log('✅ Screen Recorder File Manager initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Screen Recorder File Manager:', error);
      throw error;
    }
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    const directories = [this.tempDir, this.defaultOutputDir];
    
    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
        console.log(`📁 Ensured directory exists: ${dir}`);
      } catch (error) {
        console.warn(`⚠️ Failed to create directory ${dir}:`, error.message);
      }
    }
  }

  /**
   * Generate a unique filename for a recording
   * @param {Object} options - Recording options
   * @returns {string} Generated filename
   */
  generateFilename(options = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = options.prefix || 'recording';
    const extension = options.extension || '.webm';
    
    return `${prefix}-${timestamp}${extension}`;
  }

  /**
   * Get the full path for a recording
   * @param {string} filename - Filename
   * @param {string} [directory] - Custom directory (defaults to temp)
   * @returns {string} Full file path
   */
  getRecordingPath(filename, directory = null) {
    const targetDir = directory || this.tempDir;
    return path.join(targetDir, filename);
  }

  /**
   * Register a new recording session
   * @param {string} recordingId - Unique recording ID
   * @param {Object} fileInfo - File information
   * @returns {Object} Recording file info
   */
  registerRecording(recordingId, fileInfo) {
    const recordingInfo = {
      id: recordingId,
      filename: fileInfo.filename,
      path: fileInfo.path,
      expectedPath: fileInfo.expectedPath,
      startTime: new Date(),
      status: 'recording',
      size: 0,
      duration: 0
    };
    
    this.activeRecordings.set(recordingId, recordingInfo);
    
    console.log(`📝 Registered recording: ${recordingId} -> ${fileInfo.path}`);
    return recordingInfo;
  }

  /**
   * Update recording information
   * @param {string} recordingId - Recording ID
   * @param {Object} updates - Updates to apply
   */
  updateRecording(recordingId, updates) {
    const recording = this.activeRecordings.get(recordingId);
    if (recording) {
      Object.assign(recording, updates);
      console.log(`📝 Updated recording ${recordingId}:`, updates);
    }
  }

  /**
   * Complete a recording and move it to final location
   * @param {string} recordingId - Recording ID
   * @param {string} actualPath - Actual file path where recording was saved
   * @returns {Promise<Object>} Completed recording info
   */
  async completeRecording(recordingId, actualPath) {
    const recording = this.activeRecordings.get(recordingId);
    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }

    try {
      // Verify file exists
      const stats = await fs.stat(actualPath);
      
      // Update recording info
      const completedRecording = {
        ...recording,
        actualPath,
        status: 'completed',
        size: stats.size,
        completedTime: new Date(),
        duration: Date.now() - recording.startTime.getTime()
      };
      
      // Move from active to completed
      this.activeRecordings.delete(recordingId);
      this.completedRecordings.push(completedRecording);
      
      // Emit completion event
      this.emit('recordingCompleted', completedRecording);
      
      console.log(`✅ Recording completed: ${recordingId} (${this.formatFileSize(stats.size)})`);
      return completedRecording;
      
    } catch (error) {
      console.error(`❌ Failed to complete recording ${recordingId}:`, error);
      throw error;
    }
  }

  /**
   * Get all recordings (active and completed)
   * @returns {Promise<Array>} List of all recordings
   */
  async getAllRecordings() {
    const recordings = [
      ...Array.from(this.activeRecordings.values()),
      ...this.completedRecordings
    ];
    
    // Sort by start time (newest first)
    return recordings.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Get recordings from a specific directory
   * @param {string} [directory] - Directory to scan (defaults to temp)
   * @returns {Promise<Array>} List of recording files
   */
  async getRecordingsFromDirectory(directory = null) {
    const targetDir = directory || this.tempDir;
    
    try {
      const files = await fs.readdir(targetDir);
      const recordings = [];
      
      for (const file of files) {
        if (this.isRecordingFile(file)) {
          try {
            const filePath = path.join(targetDir, file);
            const stats = await fs.stat(filePath);
            
            recordings.push({
              name: file,
              path: filePath,
              size: stats.size,
              createdAt: stats.birthtime,
              modifiedAt: stats.mtime,
              extension: path.extname(file),
              isActive: this.isActiveRecording(filePath)
            });
          } catch (error) {
            console.warn(`⚠️ Could not get stats for ${file}:`, error.message);
          }
        }
      }
      
      // Sort by creation time (newest first)
      return recordings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    } catch (error) {
      console.error(`❌ Failed to get recordings from ${targetDir}:`, error);
      return [];
    }
  }

  /**
   * Delete a recording file
   * @param {string} filePath - Path to the file to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteRecording(filePath) {
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Remove from active recordings if present
      for (const [id, recording] of this.activeRecordings.entries()) {
        if (recording.path === filePath || recording.actualPath === filePath) {
          this.activeRecordings.delete(id);
          break;
        }
      }
      
      // Remove from completed recordings
      this.completedRecordings = this.completedRecordings.filter(
        recording => recording.path !== filePath && recording.actualPath !== filePath
      );
      
      // Delete the file
      await fs.unlink(filePath);
      
      console.log(`🗑️ Deleted recording: ${filePath}`);
      this.emit('recordingDeleted', { path: filePath });
      
      return { success: true, path: filePath };
      
    } catch (error) {
      console.error(`❌ Failed to delete recording ${filePath}:`, error);
      return { success: false, error: error.message, path: filePath };
    }
  }

  /**
   * Move a recording to a new location
   * @param {string} sourcePath - Current file path
   * @param {string} targetPath - Target file path
   * @returns {Promise<Object>} Move result
   */
  async moveRecording(sourcePath, targetPath) {
    try {
      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      await fs.mkdir(targetDir, { recursive: true });
      
      // Move the file
      await fs.rename(sourcePath, targetPath);
      
      // Update recording info
      for (const recording of this.completedRecordings) {
        if (recording.path === sourcePath || recording.actualPath === sourcePath) {
          recording.actualPath = targetPath;
          recording.path = targetPath;
          break;
        }
      }
      
      console.log(`📁 Moved recording: ${sourcePath} -> ${targetPath}`);
      this.emit('recordingMoved', { from: sourcePath, to: targetPath });
      
      return { success: true, from: sourcePath, to: targetPath };
      
    } catch (error) {
      console.error(`❌ Failed to move recording ${sourcePath} -> ${targetPath}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up old and temporary files
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanupOldFiles() {
    console.log('🧹 Starting file cleanup...');
    
    const results = {
      deletedFiles: 0,
      freedSpace: 0,
      errors: []
    };
    
    try {
      const recordings = await this.getRecordingsFromDirectory();
      const now = Date.now();
      
      for (const recording of recordings) {
        const fileAge = now - recording.createdAt.getTime();
        
        // Delete old files or files that are too large
        if (fileAge > this.config.maxFileAge || recording.size > this.config.maxFileSize) {
          try {
            await fs.unlink(recording.path);
            results.deletedFiles++;
            results.freedSpace += recording.size;
            console.log(`🗑️ Cleaned up old file: ${recording.name} (${this.formatFileSize(recording.size)})`);
          } catch (error) {
            results.errors.push({ file: recording.name, error: error.message });
          }
        }
      }
      
      // Limit number of temp files
      if (recordings.length > this.config.maxTempFiles) {
        const filesToDelete = recordings
          .slice(this.config.maxTempFiles)
          .filter(r => !r.isActive);
        
        for (const recording of filesToDelete) {
          try {
            await fs.unlink(recording.path);
            results.deletedFiles++;
            results.freedSpace += recording.size;
            console.log(`🗑️ Cleaned up excess file: ${recording.name}`);
          } catch (error) {
            results.errors.push({ file: recording.name, error: error.message });
          }
        }
      }
      
      console.log(`✅ Cleanup complete: ${results.deletedFiles} files deleted, ${this.formatFileSize(results.freedSpace)} freed`);
      
    } catch (error) {
      console.error('❌ File cleanup failed:', error);
      results.errors.push({ general: error.message });
    }
    
    return results;
  }

  /**
   * Load existing recordings from disk
   */
  async loadExistingRecordings() {
    try {
      const recordings = await this.getRecordingsFromDirectory();
      
      for (const recording of recordings) {
        // Add to completed recordings if not already tracked
        const exists = this.completedRecordings.some(r => r.path === recording.path);
        if (!exists) {
          this.completedRecordings.push({
            id: `existing-${Date.now()}-${Math.random()}`,
            filename: recording.name,
            path: recording.path,
            actualPath: recording.path,
            startTime: recording.createdAt,
            completedTime: recording.modifiedAt,
            status: 'completed',
            size: recording.size,
            duration: 0 // Unknown for existing files
          });
        }
      }
      
      console.log(`📚 Loaded ${recordings.length} existing recordings`);
      
    } catch (error) {
      console.warn('⚠️ Failed to load existing recordings:', error);
    }
  }

  /**
   * Check if a file is a recording file
   * @param {string} filename - Filename to check
   * @returns {boolean} True if it's a recording file
   */
  isRecordingFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return this.config.allowedExtensions.includes(ext);
  }

  /**
   * Check if a file path corresponds to an active recording
   * @param {string} filePath - File path to check
   * @returns {boolean} True if it's an active recording
   */
  isActiveRecording(filePath) {
    for (const recording of this.activeRecordings.values()) {
      if (recording.path === filePath || recording.expectedPath === filePath) {
        return true;
      }
    }
    return false;
  }

  /**
   * Format file size for display
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size string
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage statistics
   */
  async getStorageStats() {
    try {
      const recordings = await this.getRecordingsFromDirectory();
      
      const stats = {
        totalFiles: recordings.length,
        totalSize: recordings.reduce((sum, r) => sum + r.size, 0),
        activeRecordings: this.activeRecordings.size,
        completedRecordings: this.completedRecordings.length,
        oldestFile: recordings.length > 0 ? recordings[recordings.length - 1].createdAt : null,
        newestFile: recordings.length > 0 ? recordings[0].createdAt : null
      };
      
      return stats;
      
    } catch (error) {
      console.error('❌ Failed to get storage stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        activeRecordings: this.activeRecordings.size,
        completedRecordings: this.completedRecordings.length,
        error: error.message
      };
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    console.log('🧹 Cleaning up Screen Recorder File Manager');
    
    this.activeRecordings.clear();
    this.completedRecordings = [];
  }

  /**
   * Destroy the file manager
   */
  destroy() {
    console.log('🗑️ Destroying Screen Recorder File Manager');
    
    this.cleanup();
    this.removeAllListeners();
  }
}

module.exports = FileManager; 