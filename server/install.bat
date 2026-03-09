@echo off
REM Dock Check Local Server — Installation Script (Windows)

echo === Dock Check Local Server Setup ===

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found! Please install from https://nodejs.org
    pause
    exit /b 1
)

echo Node.js version:
node -v

REM Install dependencies
cd /d "%~dp0"
call npm install

REM Create data directories
if not exist data mkdir data
if not exist backups mkdir backups

REM Download and install NSSM (Non-Sucking Service Manager)
echo.
echo To run as a Windows service, install NSSM:
echo   1. Download from https://nssm.cc/download
echo   2. Extract nssm.exe to this directory
echo   3. Run: nssm install DockCheckServer "%cd%\start-server.bat"
echo.

REM Create start script
echo @echo off > start-server.bat
echo cd /d "%cd%" >> start-server.bat
echo set BW_DATA_DIR=%cd%\data >> start-server.bat
echo set BW_BACKUP_DIR=%cd%\backups >> start-server.bat
echo set BW_PORT=3001 >> start-server.bat
echo node index.js >> start-server.bat

echo === Setup Complete ===
echo Run start-server.bat to start the server
echo Or install as service with NSSM
pause
