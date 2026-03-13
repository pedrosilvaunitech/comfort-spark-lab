#!/bin/bash

# ============================================================
# Start - Roda frontend e print-server via PM2
# Uso: bash start.sh [--port 3001]
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_PORT=3001
GATEWAY_PORT=54321
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_PID_FILE="$PROJECT_DIR/.proxy.pid"

while [[ $# -gt 0 ]]; do
  case $1 in
    --port) APP_PORT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

cd "$PROJECT_DIR"
mkdir -p logs

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║     🚀 Iniciando Sistema via PM2                ║"
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
# 1. Docker (se existir)
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
# 2. Proxy gateway (se necessário)
# ============================================================
echo -e "${YELLOW}[2/4] Verificando proxy gateway...${NC}"
if [ -f ".env" ]; then
  SUPABASE_URL=$(grep -E "^VITE_SUPABASE_URL=" .env | tail -1 | cut -d'=' -f2- | sed 's/^"//; s/"$//')
  if [[ "$SUPABASE_URL" == *":${GATEWAY_PORT}"* ]] && [ -f "proxy-gateway.mjs" ]; then
    if ! lsof -ti:${GATEWAY_PORT} >/dev/null 2>&1; then
      nohup node proxy-gateway.mjs ${GATEWAY_PORT} >> logs/proxy.log 2>&1 &
      echo $! > "$PROXY_PID_FILE"
      echo -e "${GREEN}✓ Proxy gateway iniciado na porta ${GATEWAY_PORT}${NC}"
    else
      echo -e "${GREEN}✓ Gateway já ativo na porta ${GATEWAY_PORT}${NC}"
    fi
  fi
fi

# ============================================================
# 3. Verificar dependências e build
# ============================================================
echo -e "${YELLOW}[3/4] Verificando build...${NC}"
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}  Instalando dependências...${NC}"
  npm install --legacy-peer-deps >> logs/npm-install.log 2>&1
fi

if [ ! -d "dist" ] || [ "$(find src -newer dist/index.html 2>/dev/null | head -1)" ]; then
  echo -e "${YELLOW}  Compilando para produção...${NC}"
  npx vite build >> logs/build.log 2>&1
fi

# ============================================================
# 4. Verificar PM2 e iniciar
# ============================================================
echo -e "${YELLOW}[4/4] Iniciando via PM2...${NC}"

if ! command -v pm2 &>/dev/null; then
  echo -e "${YELLOW}  Instalando PM2 globalmente...${NC}"
  npm install -g pm2 >> logs/pm2-install.log 2>&1
fi

# Parar instâncias anteriores (se existirem)
pm2 delete ecosystem.config.cjs 2>/dev/null || true

# Atualizar porta no ecosystem se diferente
export APP_PORT

# Iniciar via PM2
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Sistema iniciado com sucesso via PM2!${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC}  http://${HOST_IP}:${APP_PORT}"
echo -e "  ${CYAN}Totem:${NC}     http://${HOST_IP}:${APP_PORT}/totem"
echo -e "  ${CYAN}Painel:${NC}    http://${HOST_IP}:${APP_PORT}/panel"
echo -e "  ${CYAN}Admin:${NC}     http://${HOST_IP}:${APP_PORT}/admin"
echo ""
echo -e "  ${CYAN}Comandos:${NC}"
echo -e "    pm2 status          - Ver status"
echo -e "    pm2 logs            - Ver logs em tempo real"
echo -e "    pm2 restart all     - Reiniciar"
echo -e "    bash stop.sh        - Parar tudo"
echo -e "${CYAN}════════════════════════════════════════════════════${NC}"
