; NSIS installer script for WhisperDesk Enhanced
; This script customizes the Windows installer

!macro customInstall
  ; Create additional shortcuts
  CreateShortCut "$DESKTOP\WhisperDesk Enhanced.lnk" "$INSTDIR\WhisperDesk Enhanced.exe"
  
  ; Register file associations for audio files
  WriteRegStr HKCR ".wav" "" "WhisperDeskAudio"
  WriteRegStr HKCR ".mp3" "" "WhisperDeskAudio"
  WriteRegStr HKCR ".m4a" "" "WhisperDeskAudio"
  WriteRegStr HKCR ".flac" "" "WhisperDeskAudio"
  WriteRegStr HKCR ".ogg" "" "WhisperDeskAudio"
  
  WriteRegStr HKCR "WhisperDeskAudio" "" "Audio File"
  WriteRegStr HKCR "WhisperDeskAudio\shell\open\command" "" '"$INSTDIR\WhisperDesk Enhanced.exe" "%1"'
  
  ; Create models directory
  CreateDirectory "$APPDATA\WhisperDesk\models"
  CreateDirectory "$APPDATA\WhisperDesk\speakers"
  CreateDirectory "$APPDATA\WhisperDesk\exports"
!macroend

!macro customUnInstall
  ; Remove file associations
  DeleteRegKey HKCR ".wav"
  DeleteRegKey HKCR ".mp3"
  DeleteRegKey HKCR ".m4a"
  DeleteRegKey HKCR ".flac"
  DeleteRegKey HKCR ".ogg"
  DeleteRegKey HKCR "WhisperDeskAudio"
  
  ; Remove desktop shortcut
  Delete "$DESKTOP\WhisperDesk Enhanced.lnk"
  
  ; Remove app data (optional - ask user)
  MessageBox MB_YESNO "Do you want to remove all WhisperDesk data including downloaded models and settings?" IDNO +3
  RMDir /r "$APPDATA\WhisperDesk"
  Goto +2
!macroend

