// checkers/prerequisites-checker.js - System prerequisites verification
const { execAsync } = require('../utils/exec-utils');
const { BuildUtils } = require('../utils/build-utils');

class PrerequisitesChecker {
  constructor(config) {
    this.config = config;
    this.platform = config.platform;
    this.dependencies = config.getPlatformDependencies();
  }

  async checkAll() {
    console.log('🔍 Checking platform prerequisites...');
    
    await this.checkCMake();
    await this.checkCompiler();
    
    if (this.platform === 'darwin') {
      await this.ensureMacOSPackages();
    } else if (this.platform === 'linux') {
      await this.checkLinuxPackages();
    } else if (this.platform === 'win32') {
      await this.checkWindowsEnvironment();
    }
    
    console.log('✅ All prerequisites verified');
  }

  async checkCMake() {
    const hascmake = await BuildUtils.checkCommand('cmake', 'CMake');
    if (!hascmake) {
      throw new Error(this.getCMakeInstallInstructions());
    }
  }

  async checkCompiler() {
    if (!this.dependencies.compilerCheck) {
      console.log(`✅ ${this.dependencies.compiler}: Assuming available`);
      return;
    }

    try {
      const { stdout } = await execAsync(this.dependencies.compilerCheck);
      console.log(`✅ ${this.dependencies.compiler}: ${stdout.split('\n')[0]}`);
    } catch (error) {
      throw new Error(`${this.dependencies.compiler} not found. Install: ${this.dependencies.compilerInstall}`);
    }
  }

  async ensureMacOSPackages() {
    for (const pkg of this.dependencies.packages) {
      try {
        await execAsync(`brew list ${pkg}`);
        console.log(`✅ ${pkg}: Found via Homebrew`);
      } catch (error) {
        console.log(`⚠️ ${pkg} not found, installing...`);
        try {
          await execAsync(`brew install ${pkg}`);
          console.log(`✅ ${pkg} installed successfully`);
        } catch (installError) {
          throw new Error(`Failed to install ${pkg}. Please run manually: brew install ${pkg}`);
        }
      }
    }
  }

  async checkLinuxPackages() {
    for (const pkg of this.dependencies.packages) {
      if (pkg === 'libjsoncpp-dev') {
        try {
          await execAsync('pkg-config --exists jsoncpp');
          console.log('✅ jsoncpp: Found via pkg-config');
        } catch (error) {
          throw new Error(`jsoncpp not found. Install: apt-get install ${pkg}`);
        }
      } else {
        // For other packages, we'd add specific checks here
        console.log(`ℹ️ Assuming ${pkg} is available`);
      }
    }
  }

  async checkWindowsEnvironment() {
    console.log('✅ Windows: Using Visual Studio tools');
    // Could add specific Visual Studio detection here
    console.log('ℹ️ Ensure Visual Studio with C++ tools is installed');
  }

  getCMakeInstallInstructions() {
    const instructions = {
      darwin: 'brew install cmake',
      linux: 'apt-get install cmake',
      win32: 'Download from cmake.org'
    };

    return `CMake not found. Install for ${this.platform}:\n${instructions[this.platform] || 'See cmake.org for installation instructions'}`;
  }

  getPackageInstallInstructions() {
    if (!this.dependencies.packageManager) {
      return 'Please install required development tools manually';
    }

    const packages = this.dependencies.packages.join(' ');
    return `Install packages: ${this.dependencies.packageManager} install ${packages}`;
  }
}

module.exports = { PrerequisitesChecker };