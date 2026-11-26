@echo off
chcp 65001 >nul
setlocal

net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Dang go cai dat IT Asset Management Windows Agent...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Stop-ScheduledTask -TaskName 'ITAssetManagementAgent' -ErrorAction SilentlyContinue;" ^
  "Unregister-ScheduledTask -TaskName 'ITAssetManagementAgent' -Confirm:$false -ErrorAction SilentlyContinue;" ^
  "Stop-ScheduledTask -TaskName 'ITAssetManagementAgentTray' -ErrorAction SilentlyContinue;" ^
  "Unregister-ScheduledTask -TaskName 'ITAssetManagementAgentTray' -Confirm:$false -ErrorAction SilentlyContinue;" ^
  "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -match 'ITAssetAgent' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

if exist "C:\Program Files\ITAssetAgent" rmdir /S /Q "C:\Program Files\ITAssetAgent"
echo Da go cai dat thanh cong! (File cau hinh tai C:\ProgramData\ITAssetAgent duoc giu lai de tham khao).
pause
endlocal
