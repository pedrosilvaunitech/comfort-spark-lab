#!/bin/bash

# ============================================================
# Start - Roda frontend e backend em segundo plano
# Uso: bash start.sh [--port 3001] [--production]
# Logs: logs/frontend.log | logs/docker.log | logs/proxy.log
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_PORT=3001
GATEWAY_PORT=54321
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_NAME=$(basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
PID_FILE="$PROJECT_DIR/.frontend.pid"
PROXY_PID_FILE="$PROJECT_DIR/.proxy.pid"
PRODUCTION=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --port) APP_PORT="$2"; shift 2 ;;
    --production) PRODUCTION=true; shift ;;
    *) shift ;;
  esac
done

extract_env_value() {
  local key="$1"
  if [ ! -f ".env" ]; then
    echo ""
    return
  fi
  grep -E "^${key}=" .env | tail -1 | cut -d'=' -f2- | sed 's/^"//; s/"$//'
}

validate_supabase_url() {
  local supabase_url
  supabase_url=$(extract_env_value "VITE_SUPABASE_URL")

  if [ -z "$supabase_url" ]; then
    echo -e "${YELLOW}⚠ VITE_SUPABASE_URL não encontrado no .env${NC}"
    return 0
  fi

  if [[ "$supabase_url" == *":3000"* || "$supabase_url" == *":9999"* || "$supabase_url" == *":8000"* ]]; then
    echo -e "${RED}✗ Configuração inválida: VITE_SUPABASE_URL=$supabase_url${NC}"
    echo -e "${RED}  Use o gateway único: VITE_SUPABASE_URL=http://<SEU_IP>:${GATEWAY_PORT}${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ VITE_SUPABASE_URL: $supabase_url${NC}"
}

start_proxy_gateway_if_needed() {
  local supabase_url
  supabase_url=$(extract_env_value "VITE_SUPABASE_URL")

  if [[ "$supabase_url" != *":${GATEWAY_PORT}"* ]]; then
    return
  fi

  if [ ! -f "proxy-gateway.mjs" ]; then
    echo -e "${YELLOW}⚠ proxy-gateway.mjs não encontrado, pulando proxy local${NC}"
    return
  fi

  if lsof -ti:${GATEWAY_PORT} >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Gateway já está ativo na porta ${GATEWAY_PORT}${NC}"
    return
  fi

  echo -e "${YELLOW}Iniciando proxy-gateway na porta ${GATEWAY_PORT}...${NC}"
  nohup node proxy-gateway.mjs ${GATEWAY_PORT} >> logs/proxy.log 2>&1 &
  local proxy_pid=$!
  echo "$proxy_pid" > "$PROXY_PID_FILE"
  sleep 1

  if kill -0 "$proxy_pid" 2>/dev/null; then
    echo -e "${GREEN}✓ Proxy gateway rodando (PID: $proxy_pid)${NC}"
  else
    echo -e "${RED}✗ Falha ao iniciar proxy. Veja logs/proxy.log${NC}"
    exit 1
  fi
}

cd "$PROJECT_DIR"
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
  echo -e "${YELLOW}[1/4] Subindo containers Docker...${NC}"
  docker compose up -d >> logs/docker.log 2>&1
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend Docker rodando${NC}"
  else
    echo -e "${RED}✗ Erro ao subir Docker. Veja logs/docker.log${NC}"
  fi
else
  echo -e "${YELLOW}[1/4] Sem docker-compose.yml, pulando backend local${NC}"
fi

# ============================================================
# 2. Validar env + subir proxy local (se necessário)
# ============================================================
echo -e "${YELLOW}[2/4] Validando configuração de API...${NC}"
validate_supabase_url
start_proxy_gateway_if_needed

# ============================================================
# 3. Matar frontend anterior se existir
# ============================================================
echo -e "${YELLOW}[3/4] Verificando processos anteriores...${NC}"
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null
    sleep 1
    echo -e "${GREEN}✓ Processo anterior (PID $OLD_PID) encerrado${NC}"
  fi
  rm -f "$PID_FILE"
fi

lsof -ti:${APP_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true

# ============================================================
# 4. Instalar deps e rodar frontend em background
# ============================================================
echo -e "${YELLOW}[4/4] Iniciando frontend na porta ${APP_PORT}...${NC}"

if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}  Instalando dependências...${NC}"
  npm install >> logs/npm-install.log 2>&1
fi

if [ "$PRODUCTION" = true ]; then
  # Build e servir produção
  if [ ! -d "dist" ] || [ "$(find src -newer dist/index.html 2>/dev/null | head -1)" ]; then
    echo -e "${YELLOW}  Compilando para produção...${NC}"
    npx vite build >> logs/build.log 2>&1
  fi
  nohup npx vite preview --host 0.0.0.0 --port ${APP_PORT} >> logs/frontend.log 2>&1 &
else
  nohup npx vite --host 0.0.0.0 --port ${APP_PORT} >> logs/frontend.log 2>&1 &
fi

FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$PID_FILE"

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
echo -e "  ${CYAN}Gateway:${NC}   http://${HOST_IP}:${GATEWAY_PORT}"
echo -e "  ${CYAN}Logs:${NC}      tail -f logs/frontend.log"
echo -e "  ${CYAN}Parar:${NC}     bash stop.sh"
echo -e "${CYAN}════════════════════════════════════════════════════${NC}"
