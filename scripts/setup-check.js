#!/usr/bin/env node

// scripts/setup-check.js - Initial setup and health check
const fs = require('fs');
const path = require('path');
const os = require('os');

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logInfo(message) { log(`ℹ️  ${message}`, 'blue'); }
function logSuccess(message) { log(`✅ ${message}`, 'green'); }
function logWarning(message) { log(`⚠️  ${message}`, 'yellow'); }
function logError(message) { log(`❌ ${message}`, 'red'); }

class SetupChecker {
    constructor() {
        this.platform = os.platform();
        this.arch = os.arch();
        this.projectRoot = process.cwd();
        this.issues = [];
        this.suggestions = [];
    }

    checkProjectStructure() {
        logInfo('Checking project structure...');
        
        const requiredFiles = [
            'package.json',
            'src/main/main.js',
            'src/main/preload.js'
        ];

        const requiredDirs = [
            'src',
            'src/main',
            'src/main/services'
        ];

        let allGood = true;

        // Check files
        for (const file of requiredFiles) {
            const filePath = path.join(this.projectRoot, file);
            if (!fs.existsSync(filePath)) {
                this.issues.push(`Missing required file: ${file}`);
                allGood = false;
            }
        }

        // Check directories
        for (const dir of requiredDirs) {
            const dirPath = path.join(this.projectRoot, dir);
            if (!fs.existsSync(dirPath)) {
                this.issues.push(`Missing required directory: ${dir}`);
                allGood = false;
            }
        }

        if (allGood) {
            logSuccess('Project structure OK');
        }

        return allGood;
    }

    checkPackageJson() {
        logInfo('Checking package.json configuration...');
        
        try {
            const packagePath = path.join(this.projectRoot, 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

            // Check if electron is in devDependencies (common issue)
            if (packageJson.dependencies && packageJson.dependencies.electron) {
                this.issues.push('Electron should be in devDependencies, not dependencies');
                this.suggestions.push('Run: npm run fix:package-dependencies');
            }

            // Check main entry point
            if (!packageJson.main || !fs.existsSync(path.join(this.projectRoot, packageJson.main))) {
                this.issues.push('Invalid main entry point in package.json');
            }

            // Check scripts
            const requiredScripts = ['start', 'build:whisper'];
            for (const script of requiredScripts) {
                if (!packageJson.scripts || !packageJson.scripts[script]) {
                    this.issues.push(`Missing script: ${script}`);
                }
            }

            if (this.issues.length === 0) {
                logSuccess('Package.json configuration OK');
            }

            return this.issues.length === 0;

        } catch (error) {
            this.issues.push(`Error reading package.json: ${error.message}`);
            return false;
        }
    }

    checkDirectories() {
        logInfo('Checking/creating required directories...');
        
        const requiredDirs = [
            'binaries',
            'models',
            'resources'
        ];

        for (const dir of requiredDirs) {
            const dirPath = path.join(this.projectRoot, dir);
            if (!fs.existsSync(dirPath)) {
                try {
                    fs.mkdirSync(dirPath, { recursive: true });
                    logInfo(`Created directory: ${dir}`);
                } catch (error) {
                    this.issues.push(`Could not create directory ${dir}: ${error.message}`);
                }
            }
        }

        logSuccess('Required directories OK');
        return true;
    }

    checkBinaryStatus() {
        logInfo('Checking whisper binary status...');
        
        const binaryExt = this.platform === 'win32' ? '.exe' : '';
        const binaryPath = path.join(this.projectRoot, 'binaries', `whisper-cli${binaryExt}`);

        if (!fs.existsSync(binaryPath)) {
            this.issues.push('Whisper binary not found');
            this.suggestions.push('Run: npm run fix:whisper');
            return false;
        }

        const stats = fs.statSync(binaryPath);
        const sizeKB = Math.round(stats.size / 1024);
        
        if (stats.size < 50000) {
            this.issues.push(`Whisper binary too small (${sizeKB} KB) - likely corrupted`);
            this.suggestions.push('Run: npm run fix:whisper:force');
            return false;
        }

        logSuccess(`Whisper binary found (${sizeKB} KB)`);
        return true;
    }

    checkModelStatus() {
        logInfo('Checking model status...');
        
        const modelsDir = path.join(this.projectRoot, 'models');
        const modelFiles = ['ggml-tiny.bin', 'ggml-base.bin'];
        
        let hasModels = false;
        
        for (const modelFile of modelFiles) {
            const modelPath = path.join(modelsDir, modelFile);
            if (fs.existsSync(modelPath)) {
                const stats = fs.statSync(modelPath);
                const sizeMB = Math.round(stats.size / 1024 / 1024);
                logInfo(`Found model: ${modelFile} (${sizeMB} MB)`);
                hasModels = true;
            }
        }

        if (!hasModels) {
            this.issues.push('No whisper models found');
            this.suggestions.push('Run: npm run build:models:tiny');
        } else {
            logSuccess('At least one model found');
        }

        return hasModels;
    }

    checkRendererStatus() {
        logInfo('Checking renderer status...');
        
        const rendererDir = path.join(this.projectRoot, 'src/renderer/whisperdesk-ui');
        
        if (!fs.existsSync(rendererDir)) {
            this.issues.push('Renderer directory not found');
            return false;
        }

        const rendererPackage = path.join(rendererDir, 'package.json');
        if (!fs.existsSync(rendererPackage)) {
            this.issues.push('Renderer package.json not found');
            return false;
        }

        const distDir = path.join(rendererDir, 'dist');
        if (!fs.existsSync(distDir)) {
            this.issues.push('Renderer not built');
            this.suggestions.push('Run: npm run build:renderer');
            return false;
        }

        logSuccess('Renderer OK');
        return true;
    }

    checkSystemRequirements() {
        logInfo('Checking system requirements...');
        
        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        
        if (majorVersion < 18) {
            this.issues.push(`Node.js ${nodeVersion} is too old (requires >=18)`);
        } else {
            logSuccess(`Node.js ${nodeVersion} OK`);
        }

        // Platform-specific checks
        if (this.platform === 'darwin') {
            logInfo(`macOS detected (${this.arch})`);
        } else if (this.platform === 'win32') {
            logInfo('Windows detected');
        } else if (this.platform === 'linux') {
            logInfo('Linux detected');
        } else {
            this.issues.push(`Unsupported platform: ${this.platform}`);
        }

        return true;
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        log('WhisperDesk Setup Check Report', 'blue');
        console.log('='.repeat(60));

        if (this.issues.length === 0) {
            logSuccess('✨ All checks passed! WhisperDesk is ready to run.');
        } else {
            logError(`Found ${this.issues.length} issue(s):`);
            this.issues.forEach((issue, index) => {
                log(`  ${index + 1}. ${issue}`, 'red');
            });
        }

        if (this.suggestions.length > 0) {
            console.log('');
            logInfo('Suggested fixes:');
            this.suggestions.forEach((suggestion, index) => {
                log(`  ${index + 1}. ${suggestion}`, 'yellow');
            });
        }

        console.log('\n' + '='.repeat(60));
        
        if (this.issues.length === 0) {
            logInfo('Run "npm start" to launch WhisperDesk');
        } else {
            logInfo('Fix the issues above, then run "npm start"');
        }
    }

    async run() {
        log('🔍 WhisperDesk Setup Check', 'blue');
        console.log('');

        this.checkSystemRequirements();
        this.checkProjectStructure();
        this.checkPackageJson();
        this.checkDirectories();
        this.checkBinaryStatus();
        this.checkModelStatus();
        this.checkRendererStatus();

        this.generateReport();

        return this.issues.length === 0;
    }
}

// Main execution
if (require.main === module) {
    const checker = new SetupChecker();
    checker.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Setup check failed:', error);
        process.exit(1);
    });
}

module.exports = SetupChecker;