#!/bin/bash

# ============================================================
# Start - Roda frontend e backend em segundo plano
# Uso: bash start.sh [--port 3001]
# Logs: logs/frontend.log | logs/docker.log
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_PORT=3001
PROJECT_NAME=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
PID_FILE=".frontend.pid"

while [[ $# -gt 0 ]]; do
  case $1 in
    --port) APP_PORT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

mkdir -p logs

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║     🚀 Iniciando Sistema - Background           ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# Detectar IP interno
HOST_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[\d.]+' | head -1)
if [ -z "$HOST_IP" ]; then
  HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [ -z "$HOST_IP" ]; then
  HOST_IP="127.0.0.1"
fi

# ============================================================
# 1. Subir Docker (backend) se docker-compose existir
# ============================================================
if [ -f "docker-compose.yml" ]; then
  echo -e "${YELLOW}[1/3] Subindo containers Docker...${NC}"
  docker compose up -d > logs/docker.log 2>&1
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend Docker rodando${NC}"
  else
    echo -e "${RED}✗ Erro ao subir Docker. Veja logs/docker.log${NC}"
  fi
else
  echo -e "${YELLOW}[1/3] Sem docker-compose.yml, pulando backend local${NC}"
fi

# ============================================================
# 2. Matar frontend anterior se existir
# ============================================================
echo -e "${YELLOW}[2/3] Verificando processos anteriores...${NC}"
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null
    sleep 1
    echo -e "${GREEN}✓ Processo anterior (PID $OLD_PID) encerrado${NC}"
  fi
  rm -f "$PID_FILE"
fi

# Matar qualquer vite na mesma porta
lsof -ti:${APP_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true

# ============================================================
# 3. Instalar deps e rodar frontend em background
# ============================================================
echo -e "${YELLOW}[3/3] Iniciando frontend na porta ${APP_PORT}...${NC}"

if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}  Instalando dependências...${NC}"
  npm install > logs/npm-install.log 2>&1
fi

# Rodar em background com nohup
nohup npx vite --host 0.0.0.0 --port ${APP_PORT} > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$PID_FILE"

# Aguardar inicialização
sleep 3
if kill -0 "$FRONTEND_PID" 2>/dev/null; then
  echo -e "${GREEN}✓ Frontend rodando em background (PID: $FRONTEND_PID)${NC}"
else
  echo -e "${RED}✗ Frontend falhou ao iniciar. Veja logs/frontend.log${NC}"
  exit 1
fi

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Sistema iniciado com sucesso!${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC}  http://${HOST_IP}:${APP_PORT}"
echo -e "  ${CYAN}Logs:${NC}      tail -f logs/frontend.log"
echo -e "  ${CYAN}Parar:${NC}     bash stop.sh"
echo -e "${CYAN}════════════════════════════════════════════════════${NC}"
