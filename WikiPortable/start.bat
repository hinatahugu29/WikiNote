@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo  Portable Wiki v2.0
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check modules
if not exist "node_modules" (
    echo [INFO] First time setup: Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Installation complete!
    echo.
)

REM Start Server
echo [INFO] Starting Wiki Server...
echo.
node server.js

pause
