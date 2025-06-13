# build/installer.nsh - Custom NSIS installer configuration for WhisperDesk

# Custom installer sections for WhisperDesk

# Add custom installer text
!define MUI_WELCOMEPAGE_TEXT "This installer will guide you through the installation of WhisperDesk, a powerful desktop transcription application.$\r$\n$\r$\nWhisperDesk provides AI-powered speech recognition with multi-speaker detection, all processed locally on your machine for privacy.$\r$\n$\r$\nClick Next to continue."

# Add license text (you can customize this)
!define MUI_LICENSEPAGE_TEXT_TOP "Please review the license terms for WhisperDesk:"
!define MUI_LICENSEPAGE_TEXT_BOTTOM "Click I Agree to continue with the installation."

# Custom completion text
!define MUI_FINISHPAGE_TEXT "WhisperDesk has been successfully installed on your computer.$\r$\n$\r$\nTo get started:$\r$\n1. Launch WhisperDesk from your Start Menu$\r$\n2. Download a model in the Models tab (Tiny model recommended for first use)$\r$\n3. Start transcribing your audio files!$\r$\n$\r$\nThank you for choosing WhisperDesk!"

# Custom function to create start menu shortcuts
Function .onInstSuccess
  # Create additional shortcuts
  CreateShortCut "$SMPROGRAMS\WhisperDesk\WhisperDesk.lnk" "$INSTDIR\WhisperDesk.exe"
  CreateShortCut "$SMPROGRAMS\WhisperDesk\Uninstall WhisperDesk.lnk" "$INSTDIR\Uninstall WhisperDesk.exe"
FunctionEnd

# Add registry entries for file associations (optional)
Section "File Associations"
  WriteRegStr HKCR ".mp3" "" "WhisperDesk.AudioFile"
  WriteRegStr HKCR ".wav" "" "WhisperDesk.AudioFile"
  WriteRegStr HKCR ".m4a" "" "WhisperDesk.AudioFile"
  WriteRegStr HKCR ".flac" "" "WhisperDesk.AudioFile"
  WriteRegStr HKCR ".ogg" "" "WhisperDesk.AudioFile"
  
  WriteRegStr HKCR "WhisperDesk.AudioFile" "" "Audio File"
  WriteRegStr HKCR "WhisperDesk.AudioFile\shell\open\command" "" '"$INSTDIR\WhisperDesk.exe" "%1"'
  WriteRegStr HKCR "WhisperDesk.AudioFile\DefaultIcon" "" "$INSTDIR\WhisperDesk.exe,0"
SectionEnd

# Custom uninstaller sections
Section "un.File Associations"
  DeleteRegKey HKCR ".mp3"
  DeleteRegKey HKCR ".wav"
  DeleteRegKey HKCR ".m4a"
  DeleteRegKey HKCR ".flac"
  DeleteRegKey HKCR ".ogg"
  DeleteRegKey HKCR "WhisperDesk.AudioFile"
SectionEnd

# Add custom pages or modify existing ones
!macro customInstall
  # Custom installation steps
  DetailPrint "Installing WhisperDesk transcription engine..."
  
  # Ensure models directory exists
  CreateDirectory "$INSTDIR\models"
  
  # Ensure binaries have correct permissions
  AccessControl::SetFileOwner "$INSTDIR\binaries\whisper-cli.exe" "$(^LoggedOnUser)"
  AccessControl::SetFileOwner "$INSTDIR\binaries\diarize-cli.exe" "$(^LoggedOnUser)"
  
  DetailPrint "WhisperDesk installation completed successfully"
!macroend

!macro customUnInstall
  # Custom uninstallation steps
  DetailPrint "Removing WhisperDesk files..."
  
  # Remove user data if requested
  MessageBox MB_YESNO "Do you want to remove your transcription models and settings? This will free up disk space but you'll need to re-download models if you reinstall." IDNO skip_user_data
    RMDir /r "$APPDATA\WhisperDesk"
    RMDir /r "$LOCALAPPDATA\WhisperDesk"
  skip_user_data:
  
  DetailPrint "WhisperDesk uninstallation completed"
!macroend

# Installer appearance customization
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "${BUILD_RESOURCES_DIR}\installer-header.bmp"

# Add version info to installer
VIProductVersion "${VERSION}"
VIAddVersionKey "ProductName" "WhisperDesk"
VIAddVersionKey "CompanyName" "WhisperDesk Team"
VIAddVersionKey "LegalCopyright" "© 2024 WhisperDesk Team"
VIAddVersionKey "FileDescription" "WhisperDesk Installer"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"

# Security settings
RequestExecutionLevel admin
ShowInstDetails show
ShowUnInstDetails show

# Modern UI settings
!define MUI_ABORTWARNING
!define MUI_UNABORTWARNING