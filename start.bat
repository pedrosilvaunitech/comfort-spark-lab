@echo off
chcp 65001 >nul
title Sistema de Senhas - Iniciar

echo ========================================
echo   Sistema de Senhas - Iniciando...
echo ========================================
echo.

:: Verificar se o build existe
if not exist dist (
    echo [ERRO] Pasta "dist" não encontrada. Execute install.bat primeiro.
    pause
    exit /b 1
)

:: Criar pasta de logs
if not exist logs mkdir logs

:: Iniciar com PM2
echo Iniciando servidor com PM2...
call pm2 start ecosystem.config.cjs
echo.

:: Mostrar IP local
echo Obtendo IP da rede...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%

echo.
echo ========================================
echo   Sistema rodando!
echo ========================================
echo.
echo   Acesse: http://%IP%:3001
echo   Totem:  http://%IP%:3001/totem
echo   Painel: http://%IP%:3001/panel
echo   Admin:  http://%IP%:3001/admin
echo.
echo   Comandos úteis:
echo     pm2 status          - Ver status
echo     pm2 logs            - Ver logs
echo     stop.bat            - Parar o sistema
echo.
pause
