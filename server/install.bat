@echo off
REM ============================================================
REM  Dock Check Local Server — Instalacao manual (Windows)
REM  
REM  IMPORTANTE: Este script e apenas para instalacao manual.
REM  O metodo recomendado e usar o instalador .exe:
REM    DockCheck-Local-Server-Setup-<versao>.exe
REM  
REM  NAO abra arquivos .js diretamente pelo Windows Explorer.
REM  Use sempre o start-server.bat ou o app instalado.
REM ============================================================

echo === Dock Check Local Server Setup ===
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Instale o Node.js 20 LTS em https://nodejs.org
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

echo.
echo === Setup Completo ===
echo.
echo Para iniciar o servidor, use UMA das opcoes:
echo   1. Execute start-server.bat (recomendado para teste manual)
echo   2. Instale o .exe via DockCheck-Local-Server-Setup
echo.
echo NAO abra arquivos .js diretamente pelo Windows Explorer.
echo.
pause
