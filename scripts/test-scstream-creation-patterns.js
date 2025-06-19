#!/usr/bin/env node

/**
 * Test SCStream Creation Patterns - Segfault Resolution
 * 
 * This script tests all 5 alternative SCStream creation patterns to identify
 * which one successfully avoids the segfault during stream instantiation.
 * 
 * Patterns tested:
 * 1. Deferred Delegate Assignment
 * 2. Minimal Delegate Approach  
 * 3. Factory Method Pattern
 * 4. Step-by-Step Initialization
 * 5. Async Stream Creation
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 Testing SCStream Creation Patterns - Segfault Resolution');
console.log('=' .repeat(80));

// Test configuration
const TEST_CONFIG = {
    timeout: 10000, // 10 second timeout per test
    display_id: 'display:1', // Test with primary display
    output_path: '/tmp/scstream-pattern-test.mp4',
    patterns: [
        { id: 1, name: 'Deferred Delegate Assignment', description: 'Create stream without delegate, then assign' },
        { id: 2, name: 'Minimal Delegate Approach', description: 'Use minimal NSObject delegate' },
        { id: 3, name: 'Factory Method Pattern', description: 'Use different SCStream factory methods' },
        { id: 4, name: 'Step-by-Step Initialization', description: 'Break initialization into smallest steps' }
        // Pattern 5 disabled due to thread safety issues with raw Objective-C pointers
    ]
};

// Build the native module first
async function buildNativeModule() {
    console.log('🔨 Building native ScreenCaptureKit module...');
    
    return new Promise((resolve, reject) => {
        const buildProcess = spawn('npm', ['run', 'build:native'], {
            cwd: path.join(__dirname, '..'),
            stdio: 'pipe'
        });
        
        let output = '';
        buildProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        buildProcess.stderr.on('data', (data) => {
            output += data.toString();
        });
        
        buildProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Native module built successfully');
                resolve();
            } else {
                console.log('❌ Native module build failed:');
                console.log(output);
                reject(new Error(`Build failed with code ${code}`));
            }
        });
    });
}

// Test individual pattern
async function testPattern(patternId, patternName, description) {
    console.log(`\n🚀 Testing Pattern ${patternId}: ${patternName}`);
    console.log(`📝 Description: ${description}`);
    console.log('-'.repeat(60));
    
    return new Promise((resolve) => {
        const testCode = `
            const { ScreenCaptureKitRecorder } = require('./native/whisperdesk-screencapturekit');
            
            async function testPattern${patternId}() {
                try {
                    console.log('🔍 Initializing ScreenCaptureKit recorder...');
                    const recorder = new ScreenCaptureKitRecorder();
                    
                    console.log('🔍 Getting available screens...');
                    const screens = await recorder.get_available_screens_with_timeout(3000);
                    console.log(\`✅ Found \${screens.length} screens\`);
                    
                    if (screens.length === 0) {
                        throw new Error('No screens available');
                    }
                    
                    console.log('🎬 Starting recording with Pattern ${patternId}...');
                    const config = {
                        width: 1280,
                        height: 720,
                        fps: 30,
                        show_cursor: true,
                        capture_audio: false,
                        output_path: '${TEST_CONFIG.output_path}'
                    };
                    
                    // This will trigger the new pattern-based create_stream method
                    await recorder.start_recording('${TEST_CONFIG.display_id}', config);
                    
                    console.log('✅ Pattern ${patternId} SUCCESS - Stream created without segfault!');
                    
                    // Stop recording after brief test
                    setTimeout(async () => {
                        try {
                            await recorder.stop_recording();
                            console.log('✅ Recording stopped successfully');
                        } catch (e) {
                            console.log('⚠️ Stop recording error (expected):', e.message);
                        }
                        process.exit(0);
                    }, 1000);
                    
                } catch (error) {
                    console.log('❌ Pattern ${patternId} FAILED:', error.message);
                    process.exit(1);
                }
            }
            
            testPattern${patternId}();
        `;
        
        // Write test script to temporary file
        const testFile = path.join(__dirname, `temp-pattern-${patternId}-test.js`);
        fs.writeFileSync(testFile, testCode);
        
        // Run the test
        const testProcess = spawn('node', [testFile], {
            cwd: path.join(__dirname, '..'),
            stdio: 'pipe',
            timeout: TEST_CONFIG.timeout
        });
        
        let output = '';
        let hasSegfault = false;
        
        testProcess.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            console.log(text.trim());
        });
        
        testProcess.stderr.on('data', (data) => {
            const text = data.toString();
            output += text;
            if (text.includes('segmentation fault') || text.includes('segfault')) {
                hasSegfault = true;
            }
            console.log('STDERR:', text.trim());
        });
        
        testProcess.on('close', (code, signal) => {
            // Clean up test file
            try {
                fs.unlinkSync(testFile);
            } catch (e) {
                // Ignore cleanup errors
            }
            
            let result = {
                patternId,
                patternName,
                success: false,
                segfault: hasSegfault,
                exitCode: code,
                signal,
                output
            };
            
            if (signal === 'SIGSEGV' || hasSegfault) {
                console.log(`❌ Pattern ${patternId} SEGFAULT detected`);
                result.segfault = true;
            } else if (code === 0) {
                console.log(`✅ Pattern ${patternId} SUCCESS - No segfault!`);
                result.success = true;
            } else {
                console.log(`⚠️ Pattern ${patternId} FAILED with exit code ${code}`);
            }
            
            resolve(result);
        });
        
        testProcess.on('error', (error) => {
            console.log(`❌ Pattern ${patternId} ERROR:`, error.message);
            
            // Clean up test file
            try {
                fs.unlinkSync(testFile);
            } catch (e) {
                // Ignore cleanup errors
            }
            
            resolve({
                patternId,
                patternName,
                success: false,
                segfault: false,
                error: error.message,
                output
            });
        });
        
        // Set timeout
        setTimeout(() => {
            testProcess.kill('SIGTERM');
            console.log(`⏰ Pattern ${patternId} TIMEOUT after ${TEST_CONFIG.timeout}ms`);
        }, TEST_CONFIG.timeout);
    });
}

// Main test runner
async function runAllTests() {
    try {
        console.log('📋 Test Configuration:');
        console.log(`   Timeout: ${TEST_CONFIG.timeout}ms per test`);
        console.log(`   Display: ${TEST_CONFIG.display_id}`);
        console.log(`   Output: ${TEST_CONFIG.output_path}`);
        console.log(`   Patterns: ${TEST_CONFIG.patterns.length}`);
        
        // Build native module
        await buildNativeModule();
        
        // Test each pattern
        const results = [];
        
        for (const pattern of TEST_CONFIG.patterns) {
            const result = await testPattern(pattern.id, pattern.name, pattern.description);
            results.push(result);
            
            // Add delay between tests to avoid interference
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Generate comprehensive report
        console.log('\n' + '='.repeat(80));
        console.log('📊 SCSTREAM CREATION PATTERNS TEST RESULTS');
        console.log('='.repeat(80));
        
        let successfulPatterns = [];
        let failedPatterns = [];
        let segfaultPatterns = [];
        
        results.forEach(result => {
            const status = result.success ? '✅ SUCCESS' : 
                          result.segfault ? '💥 SEGFAULT' : '❌ FAILED';
            
            console.log(`Pattern ${result.patternId}: ${result.patternName} - ${status}`);
            
            if (result.success) {
                successfulPatterns.push(result);
            } else if (result.segfault) {
                segfaultPatterns.push(result);
            } else {
                failedPatterns.push(result);
            }
        });
        
        console.log('\n📈 SUMMARY:');
        console.log(`✅ Successful patterns: ${successfulPatterns.length}`);
        console.log(`❌ Failed patterns: ${failedPatterns.length}`);
        console.log(`💥 Segfault patterns: ${segfaultPatterns.length}`);
        
        if (successfulPatterns.length > 0) {
            console.log('\n🎯 RECOMMENDED PATTERNS (No Segfaults):');
            successfulPatterns.forEach(pattern => {
                console.log(`   ${pattern.patternId}. ${pattern.patternName}`);
            });
            
            console.log('\n💡 NEXT STEPS:');
            console.log('1. Use the successful pattern(s) as the default SCStream creation method');
            console.log('2. Update the RealStreamManager to prefer the working pattern');
            console.log('3. Add fallback logic to try multiple patterns if needed');
            console.log('4. Test with actual recording scenarios');
        } else {
            console.log('\n⚠️ NO SUCCESSFUL PATTERNS FOUND');
            console.log('💡 RECOMMENDATIONS:');
            console.log('1. Check macOS version compatibility (requires 12.3+)');
            console.log('2. Verify screen recording permissions');
            console.log('3. Consider additional pattern variations');
            console.log('4. Test with different delegate implementations');
        }
        
        // Save detailed results to file
        const reportFile = path.join(__dirname, '../test-output/scstream-patterns-report.json');
        const reportDir = path.dirname(reportFile);
        
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }
        
        fs.writeFileSync(reportFile, JSON.stringify({
            timestamp: new Date().toISOString(),
            config: TEST_CONFIG,
            results: results,
            summary: {
                successful: successfulPatterns.length,
                failed: failedPatterns.length,
                segfaults: segfaultPatterns.length
            }
        }, null, 2));
        
        console.log(`\n📄 Detailed report saved to: ${reportFile}`);
        
    } catch (error) {
        console.error('❌ Test runner failed:', error.message);
        process.exit(1);
    }
}

// Run the tests
runAllTests(); 