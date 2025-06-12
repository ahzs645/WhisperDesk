const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');

/**
 * Promisified version of child_process.exec
 * @param {string} command - Command to execute
 * @param {object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
const execAsync = promisify(exec);

/**
 * Get the appropriate shell command based on the platform
 * @param {string} command - The command to execute
 * @returns {string} - The platform-specific command
 */
function getPlatformCommand(command) {
  const platform = os.platform();
  if (platform === 'win32') {
    return `powershell.exe -Command "${command}"`;
  }
  return command;
}

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

  const platformCommand = getPlatformCommand(command);

  // Debug log: print the command being executed
  console.log(`[exec-utils] Executing command: ${platformCommand}`);

  try {
    const result = await execAsync(platformCommand, defaultOptions);
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

module.exports = {
  execAsync,
  execWithTimeout,
  getPlatformCommand
}; 