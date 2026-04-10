@echo off
REM ============================================================
REM  Dock Check Local Server — Launcher manual para Windows
REM  Use este script para rodar o servidor a partir do codigo-fonte.
REM  NAO abra arquivos .js diretamente pelo Windows Explorer.
REM ============================================================

echo === Dock Check Local Server ===
echo.

REM Verificar Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Instale o Node.js 20 LTS em https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Node.js: 
node -v

REM Navegar para o diretorio do servidor
cd /d "%~dp0"

REM Verificar se as dependencias existem
if not exist "node_modules" (
    echo.
    echo Instalando dependencias...
    call npm install
    if %errorlevel% neq 0 (
        echo ERRO: Falha ao instalar dependencias.
        pause
        exit /b 1
    )
)

REM Verificar se o arquivo principal existe
if not exist "index.js" (
    echo ERRO: Arquivo index.js nao encontrado neste diretorio.
    echo Certifique-se de estar executando este script na pasta "server".
    pause
    exit /b 1
)

REM Criar diretorios de dados
if not exist data mkdir data
if not exist backups mkdir backups

echo.
echo Iniciando servidor na porta %BW_PORT% (padrao: 3001)...
echo Pressione Ctrl+C para parar.
echo.

node index.js

if %errorlevel% neq 0 (
    echo.
    echo O servidor parou com erro. Verifique as mensagens acima.
    pause
)
