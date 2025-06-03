// src/main/utils/exec-utils.js
const { exec } = require('child_process');
const { promisify } = require('util');

/**
 * Promisified version of child_process.exec
 * @param {string} command - Command to execute
 * @param {object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
const execAsync = promisify(exec);

/**
 * Execute command with timeout and enhanced error handling
 * @param {string} command - Command to execute
 * @param {object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function execWithTimeout(command, options = {}) {
  const defaultOptions = {
    timeout: 30000, // 30 seconds default
    maxBuffer: 1024 * 1024, // 1MB buffer
    encoding: 'utf8',
    ...options
  };

  try {
    const result = await execAsync(command, defaultOptions);
    return result;
  } catch (error) {
    // Enhanced error handling
    if (error.code === 'ETIMEDOUT') {
      throw new Error(`Command timed out after ${defaultOptions.timeout}ms: ${command}`);
    } else if (error.signal) {
      throw new Error(`Command was killed with signal ${error.signal}: ${command}`);
    } else {
      // Include both stdout and stderr in error for better debugging
      const fullError = new Error(`Command failed (exit code ${error.code}): ${command}`);
      fullError.code = error.code;
      fullError.stdout = error.stdout;
      fullError.stderr = error.stderr;
      throw fullError;
    }
  }
}

/**
 * Check if a command is available in PATH
 * @param {string} command - Command to check
 * @returns {Promise<boolean>}
 */
async function isCommandAvailable(command) {
  try {
    const checkCommand = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
    await execAsync(checkCommand, { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get command version
 * @param {string} command - Command to check
 * @param {string} versionFlag - Version flag (default: --version)
 * @returns {Promise<string>}
 */
async function getCommandVersion(command, versionFlag = '--version') {
  try {
    const { stdout } = await execAsync(`${command} ${versionFlag}`, { timeout: 5000 });
    return stdout.trim().split('\n')[0]; // Return first line
  } catch (error) {
    throw new Error(`Failed to get version for ${command}: ${error.message}`);
  }
}

module.exports = {
  execAsync,
  execWithTimeout,
  isCommandAvailable,
  getCommandVersion
};