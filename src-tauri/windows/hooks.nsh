; NSIS installer hooks (bundle.windows.nsis.installerHooks in tauri.conf.json).

; Uninstalling leaves the desktop as it was before the app:
; - the board wallpaper is replaced by the user's original wallpaper (the app does that itself
;   when started with --restore-wallpaper; a running instance gets the request and quits),
; - the start-at-login registration is removed (tauri-plugin-autostart writes these values
;   under the product name), so no dead entry stays in Task Manager > Startup apps.
; An update also runs the uninstaller, with /UPDATE; both must survive that.
!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    ExecWait '"$INSTDIR\${MAINBINARYNAME}.exe" --restore-wallpaper'
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${PRODUCTNAME}"
  ${EndIf}
!macroend
