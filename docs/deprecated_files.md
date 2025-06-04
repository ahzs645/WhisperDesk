# Potentially Unnecessary Files

This document lists files within the repository that may be outdated, redundant, or no longer in use. Review these files carefully before considering their removal. The reasons provided are initial assessments and require verification.

## Candidate Files

*   **`Test Scripts/local_build_script.sh`**
    *   **Reason:** The name suggests this might be a script for local development or an older version of a build process. Its functionality might now be covered by other scripts (e.g., within `scripts/`) or the main `npm run build` / `npm run dev` commands.

*   **`binaries/whisper-cli`**
    *   **Reason:** This appears to be a pre-compiled whisper.cpp binary. If the project always builds this binary from source during setup (e.g., via `npm run build:whisper` which calls platform-specific scripts like `scripts/build-whisper.sh` or `scripts/compile-whisper-windows.ps1`), versioning the binary itself might be unnecessary and could lead to outdated versions being committed. However, it could also serve as a fallback if local compilation fails, or be a very specific known-good version. *Verification needed: Is this binary always built from source by scripts?*

*   **`quick_provider_setup.sh`**
    *   **Reason:** The name "quick" suggests it might have been a temporary helper script or for a specific setup task that is either no longer relevant or has been integrated into the main setup scripts (`scripts/setup.sh`, `scripts/setup.ps1`).

*   **`scripts/build-whisper.js`**
    *   **Reason:** There is also `scripts/build-whisper.sh` and `scripts/build-whisper-cross-platform.js`. It's possible that `build-whisper-cross-platform.js` is intended to be the primary script for this purpose. If so, `build-whisper.js` (Node.js script) might be redundant or an older approach if the cross-platform script or platform-specific shell scripts (`build-whisper.sh`, `compile-whisper-windows.ps1`) are now preferred. *Verification needed: What is the role of each `build-whisper` script?*

*   **`scripts/build.bat`**
    *   **Reason:** This is a Windows batch script for building. The project uses `npm` scripts (`npm run build`) which often call other scripts in the `scripts/` directory. This top-level `build.bat` might be an older entry point or not aligned with the primary `npm`-based build process. *Verification needed: Is this script still used or documented as the way to build?*

*   **`scripts/build.sh`** (root level script, not `scripts/build-whisper.sh`)
    *   **Reason:** Similar to `scripts/build.bat`, this shell script might be an older build entry point. Modern JavaScript projects typically use `npm run build`. *Verification needed: Is this script still used or documented?*

*   **`test-native-services.js`** (root level)
    *   **Reason:** This appears to be a standalone test script. The project has `npm run test:native` defined in `package.json` (as seen in README). Does this npm script call this specific file, or is there a more integrated test suite? If this is an old or unmaintained test, it might be deprecated.

*   **`test-transcription.js`** (root level)
    *   **Reason:** Similar to `test-native-services.js`, this is a standalone test script. The project has `npm run test:transcription` defined. It's important to verify if this npm script calls this file or if there's a newer/preferred way of running these tests.

*   **`whisper-blas-bin-macos-arm64.zip`**
    *   **Reason:** This is a zipped binary, likely a BLAS library for macOS ARM64. Such dependencies are often downloaded during the build or setup process (e.g., by `scripts/download-binaries.js` or as part of `npm run build:whisper`). If it's automatically fetched and unzipped by a script, versioning the .zip file directly in the repository might be unnecessary and add to bloat. *Verification needed: Is this file downloaded by a script, or is it intended to be manually provided?*

*   **`scripts/fix-whisper-dependencies.js`**
    *   **Reason:** Scripts with "fix" in their name can sometimes be temporary workarounds for specific issues or older versions. It's worth investigating if the issues this script addresses are still relevant or have been resolved in newer versions of dependencies or build processes.

*   **`scripts/test-binary.js`**
    *   **Reason:** This script's purpose seems to be testing a binary. This might be covered by `npm run test:native` or other testing scripts. Its necessity and current usage should be verified.

*   **`scripts/test-whisper-static-binary.ps1`**
    *   **Reason:** A PowerShell script for testing a static binary. Similar to other standalone test scripts, its integration into the main testing workflow (`npm test` or specific test commands in `package.json`) should be checked.

**Note:** Removal of any file should be done with caution, ensuring that it doesn't break any part of the development, build, testing, or deployment process. Always verify the role of each file before deprecating it.
