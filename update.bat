@echo off
chcp 65001 >nul
title Sistema de Senhas - Atualizar

echo ========================================
echo   Sistema de Senhas - Atualizando...
echo ========================================
echo.

echo [1/4] Baixando atualizações...
git pull
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha no git pull
    pause
    exit /b 1
)

echo [2/4] Instalando dependências...
call npm install --legacy-peer-deps

echo [3/4] Compilando...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha no build
    pause
    exit /b 1
)

echo [4/4] Reiniciando serviço...
call pm2 restart senhas-frontend

echo.
echo ========================================
echo   Atualização concluída!
echo ========================================
pause
