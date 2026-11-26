@echo off
chcp 65001 >nul
echo ============================================================
echo   IT ASSET MANAGEMENT - DUNG HE THONG
echo ============================================================
echo.

powershell -NoProfile -Command "foreach ($port in @(3001, 5175)) { $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; foreach ($c in $conns) { $p = $c.OwningProcess; if ($p -gt 0) { Write-Host ('Dang dung PID ' + $p + ' tren port ' + $port); Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } } }"

echo.
echo Da dung Backend ^(3001^) va Frontend ^(5175^).
timeout /t 2 >nul
