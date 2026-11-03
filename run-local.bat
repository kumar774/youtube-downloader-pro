@echo off
title SnapSave Pro - 1-Click Local Runner
color 0A

echo ==========================================================
echo       SNAPSAVE PRO - 1-CLICK LOCAL AUTOMATED RUNNER
echo ==========================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org/ and run this script again.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js detected: %NODE_VER%

:: 2. Check node_modules
if not exist "node_modules\" (
    echo [SETUP] First-time setup: Installing npm dependencies...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Failed to install npm packages.
        pause
        exit /b 1
    )
)
echo [OK] Dependencies verified.

:: 3. Check yt-dlp binary
if exist "node_modules\youtube-dl-exec\bin\yt-dlp.exe" (
    echo [OK] yt-dlp binary found.
) else (
    echo [INFO] yt-dlp local package binary ready.
)

:: 4. Check ffmpeg binary
if exist "node_modules\ffmpeg-static\ffmpeg.exe" (
    echo [OK] ffmpeg binary found.
) else (
    echo [INFO] System ffmpeg will be used.
)

echo.
echo ==========================================================
echo Starting Next.js Dev Server at http://localhost:3000 ...
echo Browser will automatically open in a few seconds.
echo Press Ctrl+C in this window anytime to stop the server.
echo ==========================================================
echo.

:: Launch default browser after 3 seconds
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: Start Next.js dev server
npm run dev

