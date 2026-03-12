#!/bin/bash
# ============================================================
# install-cloud.sh — Frontend local + Backend Lovable Cloud
# Uso: bash install-cloud.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_PORT=3001

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║  ☁️  Frontend Local + Backend Cloud               ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# Detectar IP
HOST_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[\d.]+' | head -1)
[ -z "$HOST_IP" ] && HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$HOST_IP" ] && HOST_IP="127.0.0.1"
echo -e "${GREEN}✓ IP: ${HOST_IP}${NC}"

# Configurar .env
echo -e "${YELLOW}Configurando .env...${NC}"
[ -f ".env" ] && cp .env ".env.backup.$(date +%Y%m%d%H%M%S)"

cat > .env << 'ENVEOF'
VITE_SUPABASE_URL=https://pbjyudhxnhtxiblhkwgh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBianl1ZGh4bmh0eGlibGhrd2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTQ2NjAsImV4cCI6MjA4NzY3MDY2MH0.x1EjCqhJGfKwNu21GtN0jwm-nfwBJWzMHdD8ycWBXEM
VITE_SUPABASE_PROJECT_ID=pbjyudhxnhtxiblhkwgh
ENVEOF

echo -e "${GREEN}✓ .env configurado para Cloud${NC}"

# Instalar dependências
echo -e "${YELLOW}Instalando dependências...${NC}"
npm install --legacy-peer-deps 2>&1 | tail -3
echo -e "${GREEN}✓ Dependências instaladas${NC}"

# Build
echo -e "${YELLOW}Compilando frontend...${NC}"
npx vite build 2>&1 | tail -5
echo -e "${GREEN}✓ Build concluído${NC}"

# Resultado
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Instalação concluída!                            ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}Iniciar:${NC}"
echo -e "${GREEN}║${NC}    ${YELLOW}npx vite preview --host 0.0.0.0 --port ${APP_PORT}${NC}"
echo -e "${GREEN}║${NC}    ${YELLOW}Ou: pm2 start ecosystem.config.cjs${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}Acessos:${NC}"
echo -e "${GREEN}║${NC}    Frontend: http://${HOST_IP}:${APP_PORT}"
echo -e "${GREEN}║${NC}    Login:    http://${HOST_IP}:${APP_PORT}/login"
echo -e "${GREEN}║${NC}    Admin:    http://${HOST_IP}:${APP_PORT}/admin"
echo -e "${GREEN}║${NC}    Totem:    http://${HOST_IP}:${APP_PORT}/totem"
echo -e "${GREEN}║${NC}    Painel:   http://${HOST_IP}:${APP_PORT}/panel"
echo -e "${GREEN}║${NC}    Guichê:   http://${HOST_IP}:${APP_PORT}/counter"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}Sem necessidade de backend local!${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}Tudo roda via Cloud automaticamente.${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
