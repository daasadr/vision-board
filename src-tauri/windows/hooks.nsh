; NSIS installer hooks (bundle.windows.nsis.installerHooks in tauri.conf.json).

; Uninstalling removes the start-at-login registration (tauri-plugin-autostart writes these
; values under the product name), so no dead entry stays in Task Manager > Startup apps.
; An update also runs the uninstaller, with /UPDATE; the registration must survive that.
!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${PRODUCTNAME}"
  ${EndIf}
!macroend
