@echo off
chcp 65001 >nul
title Sistema de Senhas - Parar

echo Parando o sistema...
call pm2 stop senhas-frontend
call pm2 delete senhas-frontend
echo.
echo Sistema parado.
pause
