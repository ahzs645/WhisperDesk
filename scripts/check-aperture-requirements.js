// scripts/check-aperture-requirements.js
const os = require('os');
const { execSync } = require('child_process');

console.log('🔍 Checking Aperture requirements...');

function checkApertureRequirements() {
  const results = {
    platform: process.platform,
    arch: process.arch,
    macOSVersion: null,
    nodeVersion: process.version,
    requirements: {
      platform: false,
      macOSVersion: false,
      nodeVersion: false,
      xcode: false
    },
    recommendations: []
  };
  
  // Check platform
  if (process.platform === 'darwin') {
    results.requirements.platform = true;
    console.log('✅ Platform: macOS');
  } else {
    console.log('❌ Platform: Not macOS (Aperture requires macOS)');
    results.recommendations.push('Aperture is only available on macOS');
    return results;
  }
  
  // Check macOS version
  try {
    const version = getMacOSVersion();
    results.macOSVersion = version;
    
    if (version >= 13) {
      results.requirements.macOSVersion = true;
      console.log(`✅ macOS Version: ${version} (ScreenCaptureKit supported)`);
    } else {
      console.log(`❌ macOS Version: ${version} (ScreenCaptureKit requires macOS 13+)`);
      results.recommendations.push('Upgrade to macOS 13 (Ventura) or later');
    }
  } catch (error) {
    console.log('❌ Could not determine macOS version');
    results.recommendations.push('Unable to verify macOS version');
  }
  
  // Check Node.js version
  const nodeVersion = process.version.slice(1); // Remove 'v'
  const nodeMajor = parseInt(nodeVersion.split('.')[0]);
  
  if (nodeMajor >= 16) {
    results.requirements.nodeVersion = true;
    console.log(`✅ Node.js Version: ${nodeVersion}`);
  } else {
    console.log(`❌ Node.js Version: ${nodeVersion} (Aperture requires Node.js 16+)`);
    results.recommendations.push('Upgrade to Node.js 16 or later');
  }
  
  // Check for Xcode Command Line Tools (required for native modules)
  try {
    execSync('xcode-select -p', { stdio: 'pipe' });
    results.requirements.xcode = true;
    console.log('✅ Xcode Command Line Tools: Installed');
  } catch (error) {
    console.log('❌ Xcode Command Line Tools: Not installed');
    results.recommendations.push('Install Xcode Command Line Tools: xcode-select --install');
  }
  
  // Summary
  const allRequirementsMet = Object.values(results.requirements).every(req => req);
  
  if (allRequirementsMet) {
    console.log('\n🎉 All requirements met! Aperture can be installed.');
  } else {
    console.log('\n⚠️ Some requirements not met. Recommendations:');
    results.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
    console.log('\n💡 Without Aperture, WhisperDesk will use browser-based recording');
  }
  
  return results;
}

function getMacOSVersion() {
  const release = os.release();
  const parts = release.split('.');
  const major = parseInt(parts[0]);
  return major - 9; // Convert Darwin to macOS version
}

if (require.main === module) {
  const results = checkApertureRequirements();
  
  // Exit with appropriate code
  const allRequirementsMet = Object.values(results.requirements).every(req => req);
  process.exit(allRequirementsMet ? 0 : 1);
}

module.exports = { checkApertureRequirements };