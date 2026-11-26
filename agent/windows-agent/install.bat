@echo off
chcp 65001 >nul
setlocal

:: Auto-elevate to Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Dang yeu cau quyen Administrator de cai dat IT Asset Agent...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================================
echo   IT ASSET MANAGEMENT - CAI DAT WINDOWS AGENT
echo ============================================================

set "SRC=%~dp0"
set "INSTALL_DIR=C:\Program Files\ITAssetAgent"
set "DATA_DIR=C:\ProgramData\ITAssetAgent"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

copy /Y "%SRC%ITAssetAgent.ps1" "%INSTALL_DIR%\ITAssetAgent.ps1" >nul
copy /Y "%SRC%ITAssetAgentTray.ps1" "%INSTALL_DIR%\ITAssetAgentTray.ps1" >nul
copy /Y "%SRC%uninstall.bat" "%INSTALL_DIR%\uninstall.bat" >nul
if exist "%SRC%config.json" (
    copy /Y "%SRC%config.json" "%DATA_DIR%\config.json" >nul
)

echo [1/3] Dang ky dich vu chay ngam (Scheduled Task - SYSTEM)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"C:\Program Files\ITAssetAgent\ITAssetAgent.ps1\" -Mode Daemon -ConfigPath \"C:\ProgramData\ITAssetAgent\config.json\"';" ^
  "$trigger = New-ScheduledTaskTrigger -AtStartup;" ^
  "$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest;" ^
  "$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero);" ^
  "Register-ScheduledTask -TaskName 'ITAssetManagementAgent' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null;" ^
  "Start-ScheduledTask -TaskName 'ITAssetManagementAgent'"

echo [2/3] Dang ky bieu tuong khay he thong (System Tray)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"C:\Program Files\ITAssetAgent\ITAssetAgentTray.ps1\"';" ^
  "$trigger = New-ScheduledTaskTrigger -AtLogOn;" ^
  "$principal = New-ScheduledTaskPrincipal -GroupId 'BUILTIN\Users' -RunLevel Limited;" ^
  "$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero);" ^
  "Register-ScheduledTask -TaskName 'ITAssetManagementAgentTray' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null;" ^
  "Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"C:\Program Files\ITAssetAgent\ITAssetAgentTray.ps1\"'"

echo [3/3] Dang chay dong bo lan dau...
powershell -NoProfile -ExecutionPolicy Bypass -File "%INSTALL_DIR%\ITAssetAgent.ps1" -Mode Once -ConfigPath "%DATA_DIR%\config.json"

echo.
echo ============================================================
echo   CAI DAT THANH CONG!
echo   - Thu muc cai dat : %INSTALL_DIR%
echo   - File cau hinh   : %DATA_DIR%\config.json
echo   - File nhat ky    : %DATA_DIR%\logs\agent.log
echo   - Go cai dat      : %INSTALL_DIR%\uninstall.bat
echo ============================================================
pause
endlocal
