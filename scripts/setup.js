const { spawn } = require('child_process');
const path = require('path');

async function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`Running: ${command} ${args.join(' ')}`);
        const process = spawn(command, args, { stdio: 'inherit', ...options });

        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });

        process.on('error', (error) => {
            reject(error);
        });
    });
}

async function findPython() {
    const pythonCommands = ['python3', 'python'];
    
    for (const cmd of pythonCommands) {
        try {
            await runCommand(cmd, ['--version']);
            return cmd;
        } catch (error) {
            continue;
        }
    }
    
    throw new Error('Python not found. Please install Python 3.8 or later.');
}

async function installPythonDependencies() {
    try {
        console.log('Setting up WhisperDesk Python dependencies...');
        
        const pythonCmd = await findPython();
        console.log(`Found Python: ${pythonCmd}`);
        
        const requirementsPath = path.join(__dirname, '..', 'requirements.txt');
        
        console.log('Installing Python dependencies...');
        await runCommand(pythonCmd, ['-m', 'pip', 'install', '-r', requirementsPath]);
        
        console.log('✅ Python dependencies installed successfully!');
        console.log('You can now run: npm run dev');
        
    } catch (error) {
        console.error('❌ Failed to install Python dependencies:');
        console.error(error.message);
        console.error('\nPlease manually run:');
        console.error('pip install -r requirements.txt');
        process.exit(1);
    }
}

if (require.main === module) {
    installPythonDependencies();
}

module.exports = { installPythonDependencies };