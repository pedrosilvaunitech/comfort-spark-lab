#!/bin/bash

# ============================================================
# Instala serviço systemd para auto-start no boot
# Uso: sudo bash install-service.sh [--port 3001] [--production]
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_PORT=3001
PRODUCTION=""
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_NAME=$(basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
SERVICE_NAME="fila-${PROJECT_NAME}"
CURRENT_USER="${SUDO_USER:-$(whoami)}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --port) APP_PORT="$2"; shift 2 ;;
    --production) PRODUCTION="--production"; shift ;;
    *) shift ;;
  esac
done

# Verificar root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Execute com sudo: sudo bash install-service.sh${NC}"
  exit 1
fi

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║  🔧 Instalando Serviço de Auto-Start            ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# Detectar Node.js path
NODE_PATH=$(which node)
NPX_PATH=$(which npx)

if [ -z "$NODE_PATH" ]; then
  # Tentar NVM do usuário
  NVM_DIR="/home/${CURRENT_USER}/.nvm"
  if [ -d "$NVM_DIR" ]; then
    NODE_PATH=$(find "$NVM_DIR" -name "node" -type f 2>/dev/null | head -1)
    NPX_PATH=$(find "$NVM_DIR" -name "npx" -type f 2>/dev/null | head -1)
  fi
fi

if [ -z "$NODE_PATH" ]; then
  echo -e "${RED}Node.js não encontrado!${NC}"
  exit 1
fi

NODE_DIR=$(dirname "$NODE_PATH")

echo -e "${YELLOW}Projeto:${NC}  $PROJECT_DIR"
echo -e "${YELLOW}Serviço:${NC}  $SERVICE_NAME"
echo -e "${YELLOW}Usuário:${NC}  $CURRENT_USER"
echo -e "${YELLOW}Node:${NC}     $NODE_PATH"
echo -e "${YELLOW}Porta:${NC}    $APP_PORT"
echo ""

# Criar serviço systemd
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Sistema de Filas - ${PROJECT_NAME}
After=network.target docker.service
Wants=docker.service

[Service]
Type=forking
User=${CURRENT_USER}
Group=${CURRENT_USER}
WorkingDirectory=${PROJECT_DIR}
Environment=PATH=${NODE_DIR}:/usr/local/bin:/usr/bin:/bin
Environment=HOME=/home/${CURRENT_USER}
Environment=NODE_ENV=production
ExecStart=/bin/bash ${PROJECT_DIR}/start.sh --port ${APP_PORT} ${PRODUCTION}
ExecStop=/bin/bash ${PROJECT_DIR}/stop.sh
PIDFile=${PROJECT_DIR}/.frontend.pid
Restart=on-failure
RestartSec=10
StartLimitBurst=5
StartLimitIntervalSec=60

[Install]
WantedBy=multi-user.target
EOF

chmod 644 /etc/systemd/system/${SERVICE_NAME}.service

# Ativar e iniciar
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl start ${SERVICE_NAME}

sleep 3
STATUS=$(systemctl is-active ${SERVICE_NAME})

echo ""
if [ "$STATUS" = "active" ]; then
  echo -e "${GREEN}✅ Serviço instalado e rodando!${NC}"
else
  echo -e "${YELLOW}⚠ Serviço instalado mas status: ${STATUS}${NC}"
  echo -e "${YELLOW}  Verifique: journalctl -u ${SERVICE_NAME} -f${NC}"
fi

echo ""
echo -e "${CYAN}Comandos úteis:${NC}"
echo -e "  sudo systemctl status ${SERVICE_NAME}    # Ver status"
echo -e "  sudo systemctl restart ${SERVICE_NAME}   # Reiniciar"
echo -e "  sudo systemctl stop ${SERVICE_NAME}      # Parar"
echo -e "  journalctl -u ${SERVICE_NAME} -f         # Ver logs"
echo -e "  sudo systemctl disable ${SERVICE_NAME}   # Desativar auto-start"
