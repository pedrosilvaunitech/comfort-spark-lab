@echo off
chcp 65001 >nul
title Sistema de Senhas - Iniciar via PM2

echo ========================================
echo   Sistema de Senhas - Iniciando...
echo ========================================
echo.

:: Criar pasta de logs
if not exist logs mkdir logs

:: Verificar se node_modules existe
if not exist node_modules (
    echo Instalando dependencias...
    call npm install --legacy-peer-deps >logs\npm-install.log 2>&1
)

:: Verificar se o build existe
if not exist dist (
    echo Compilando para producao...
    call npx vite build >logs\build.log 2>&1
)

if not exist dist (
    echo [ERRO] Build falhou. Veja logs\build.log
    pause
    exit /b 1
)

:: Verificar PM2
where pm2 >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Instalando PM2 globalmente...
    call npm install -g pm2 >logs\pm2-install.log 2>&1
)

:: Parar instancias anteriores
call pm2 delete ecosystem.config.cjs >nul 2>&1

:: Iniciar com PM2
echo Iniciando servidor com PM2...
call pm2 start ecosystem.config.cjs
call pm2 save
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
echo   Sistema rodando via PM2!
echo ========================================
echo.
echo   Acesse:  http://%IP%:3001
echo   Totem:   http://%IP%:3001/totem
echo   Painel:  http://%IP%:3001/panel
echo   Admin:   http://%IP%:3001/admin
echo.
echo   Comandos uteis:
echo     pm2 status          - Ver status
echo     pm2 logs            - Ver logs
echo     pm2 restart all     - Reiniciar
echo     stop.bat            - Parar o sistema
echo.
pause
