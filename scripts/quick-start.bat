@echo off
setlocal enabledelayedexpansion

REM Self-Streme Quick Start Script for Windows
REM One command to set everything up and run the torrent streaming service

title Self-Streme Quick Start

echo.
echo ========================================================
echo.
echo           Self-Streme Quick Start
echo      Torrent Streaming Service + Stremio Addon
echo.
echo ========================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Node.js is not installed
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% detected

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] npm is not installed
    pause
    exit /b 1
)

for /f "tokens=1" %%i in ('npm -v') do set NPM_VERSION=%%i
echo [OK] npm %NPM_VERSION% detected
echo.

REM Install dependencies
echo [1/5] Installing dependencies...
if not exist "node_modules" (
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [X] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
) else (
    echo [INFO] node_modules exists, skipping install
    echo        Run 'rmdir /s node_modules && npm install' to reinstall
)
echo.

REM Create .env file if it doesn't exist
echo [2/5] Configuring environment...
if not exist ".env" (
    (
        echo # Server Configuration
        echo PORT=7000
        echo ADDON_PORT=7001
        echo NODE_ENV=development
        echo.
        echo # Cache Configuration
        echo CACHE_BACKEND=memory
        echo CACHE_MAX_DISK_MB=10000
        echo CACHE_TTL=86400
        echo.
        echo # Torrent Configuration
        echo TORRENT_TIMEOUT=60000
        echo TORRENT_MAX_RETRIES=3
        echo TORRENT_RETRY_DELAY=5000
        echo.
        echo # Optional: Redis ^(if using Redis backend^)
        echo # REDIS_URL=redis://localhost:6379
        echo.
        echo # Optional: API Security
        echo # API_KEY=your-secret-api-key-here
    ) > .env
    echo [OK] Created .env configuration file
) else (
    echo [INFO] .env already exists, skipping
)
echo.

REM Check port availability
echo [3/5] Checking ports...
netstat -ano | findstr ":7000" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [WARNING] Port 7000 is already in use
    echo           You may need to change PORT in .env
) else (
    echo [OK] Port 7000 is available
)

netstat -ano | findstr ":7001" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [WARNING] Port 7001 is already in use
    echo           You may need to change ADDON_PORT in .env
) else (
    echo [OK] Port 7001 is available
)
echo.

REM Display firewall info
echo [4/5] Network configuration...
echo [INFO] For optimal BitTorrent performance, open ports:
echo        TCP/UDP 6881-6889 ^(BitTorrent P2P^)
echo        TCP 7000 ^(Torrent API ^& Streaming^)
echo        TCP 7001 ^(Stremio Addon^)
echo.
echo Windows Firewall commands ^(run as Administrator if needed^):
echo   netsh advfirewall firewall add rule name="Self-Streme Torrent" dir=in action=allow protocol=TCP localport=6881-6889
echo   netsh advfirewall firewall add rule name="Self-Streme Torrent UDP" dir=in action=allow protocol=UDP localport=6881-6889
echo   netsh advfirewall firewall add rule name="Self-Streme API" dir=in action=allow protocol=TCP localport=7000
echo   netsh advfirewall firewall add rule name="Self-Streme Addon" dir=in action=allow protocol=TCP localport=7001
echo.

REM Create data directory
if not exist "data\cache" mkdir data\cache
echo [OK] Created data directories
echo.

REM Start the service
echo [5/5] Starting Self-Streme...
echo.
echo ========================================================
echo Service URLs:
echo ========================================================
echo   Torrent Test UI:     http://localhost:7000/test-torrent-streaming
echo   API Documentation:   http://localhost:7000/docs
echo   Health Check:        http://localhost:7000/health
echo   Stremio Addon:       http://localhost:7001/manifest.json
echo ========================================================
echo.
echo Test with Big Buck Bunny ^(Public Domain^):
echo   Magnet: magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
echo.
echo Press Ctrl+C to stop the server
echo.
echo Starting now...
echo.

REM Start the server
call npm start
