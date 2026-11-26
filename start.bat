@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ============================================================
echo   IT ASSET MANAGEMENT - KHOI DONG HE THONG QUAN LY TAI SAN
echo ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Node.js! Vui long cai dat Node.js v20+ truoc.
    pause
    exit /b 1
)

if not exist "backend\node_modules" (
    echo [1/4] Cai dat dependencies cho Backend...
    call npm --prefix backend install
    if errorlevel 1 (
        echo [LOI] Cai dat Backend that bai.
        pause
        exit /b 1
    )
)

if not exist "frontend\node_modules" (
    echo [1/4] Cai dat dependencies cho Frontend...
    call npm --prefix frontend install
    if errorlevel 1 (
        echo [LOI] Cai dat Frontend that bai.
        pause
        exit /b 1
    )
)

if not exist "backend\prisma\dev.db" (
    echo [2/4] Khoi tao co so du lieu va nap du lieu mau...
    call npm --prefix backend run db:setup
    if errorlevel 1 (
        echo [LOI] Khoi tao database that bai.
        pause
        exit /b 1
    )
) else (
    echo [2/4] Co so du lieu da san sang ^(backend\prisma\dev.db^).
)

if not exist "backend\dist\main.js" (
    echo [3/4] Build NestJS Backend...
    call npm --prefix backend run build
    if errorlevel 1 (
        echo [LOI] Build Backend that bai.
        pause
        exit /b 1
    )
)

echo [4/4] Dang khoi dong Backend API ^(port 3001^) va Frontend Web ^(port 5175^)...

start "ITAM - Backend API (Port 3001)" /D "%~dp0backend" cmd /k "npm run start:prod"
start "ITAM - Frontend Web (Port 5175)" /D "%~dp0frontend" cmd /k "npm run dev"

echo.
echo Dang cho he thong san sang...
powershell -NoProfile -Command "$max=20; for($i=0; $i -lt $max; $i++){ try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3001/api/v1/health' -TimeoutSec 2; if($r.StatusCode -eq 200){ break } } catch {}; Start-Sleep -Seconds 1 }"

echo.
echo ============================================================
echo   HE THONG DA KHOI DONG THANH CONG!
echo ============================================================
echo   Web App     : http://localhost:5175
echo   Backend API : http://localhost:3001
echo   Swagger API : http://localhost:3001/api/docs
echo.
echo   Tai khoan mau ^(Mat khau: Admin@123^):
echo     - sysadmin  ^(System Admin^)
echo     - itadmin   ^(IT Admin^)
echo     - itstaff   ^(IT Staff^)
echo     - qaviewer  ^(Department Viewer - QA^)
echo.
echo   De tat he thong, chay file: stop.bat
echo ============================================================
echo.

start "" "http://localhost:5175"
endlocal
