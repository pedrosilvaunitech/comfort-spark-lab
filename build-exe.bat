@echo off
chcp 65001 >nul
title Sistema de Senhas - Build .EXE
cd /d "%~dp0"

echo ========================================
echo   Build do .EXE (Electron)
echo ========================================
echo.

:: Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Node.js não encontrado!
    pause
    exit /b 1
)

:: 1. Build do frontend
echo [1/4] Compilando frontend...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha no build do frontend
    pause
    exit /b 1
)

:: 2. Copiar dist para pasta electron
echo [2/4] Copiando build para pasta Electron...
if exist electron\dist rmdir /s /q electron\dist
xcopy dist electron\dist\ /E /I /Q

:: 3. Instalar deps do Electron
echo [3/4] Instalando dependências Electron...
cd electron
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha ao instalar deps Electron
    pause
    exit /b 1
)

:: 4. Build .exe (sem code signing para evitar erro de symlink)
echo [4/4] Gerando .EXE...
set CSC_IDENTITY_AUTO_DISCOVERY=false
set WIN_CSC_LINK=
set CSC_LINK=
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha ao gerar .EXE
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo ========================================
echo   .EXE gerado com sucesso!
echo   Arquivo: electron-dist\SistemaDeSenhas-1.0.0.exe
echo ========================================
echo.
pause
