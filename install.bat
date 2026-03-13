@echo off
chcp 65001 >nul
title Sistema de Senhas - Instalação

echo ========================================
echo   Sistema de Senhas - Instalação Windows
echo ========================================
echo.

:: Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Node.js não encontrado!
    echo Baixe em: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do echo [OK] Node.js %%v encontrado

:: Instalar dependências
echo.
echo [1/3] Instalando dependências...
call npm install --legacy-peer-deps
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha ao instalar dependências
    pause
    exit /b 1
)

:: Build
echo.
echo [2/3] Compilando o projeto...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha no build
    pause
    exit /b 1
)

:: Instalar PM2 global
echo.
echo [3/3] Instalando PM2...
call npm install -g pm2
if %ERRORLEVEL% neq 0 (
    echo [AVISO] Falha ao instalar PM2 globalmente. Tente rodar como Administrador.
)

:: Criar pasta de logs
if not exist logs mkdir logs

echo.
echo ========================================
echo   Instalação concluída com sucesso!
echo ========================================
echo.
echo Próximos passos:
echo   1. Edite o arquivo .env com suas credenciais do Supabase
echo   2. Rode "npm run build" novamente após editar o .env
echo   3. Execute start.bat para iniciar o sistema
echo.
pause
