#!/bin/bash
# ============================================================
# install-cloud.sh — Frontend local + Backend Supabase Cloud
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
echo "║  ☁️  Frontend Local + Backend Supabase Cloud      ║"
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
VITE_SUPABASE_URL=https://rjeuoheiayfzioqfdoom.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZXVvaGVpYXlmemlvcWZkb29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDE3MTEsImV4cCI6MjA4ODkxNzcxMX0.tA9aoHDEeL4mgSoQ1DF1G8vAhcSabWZLqW-ALksP9c0
VITE_SUPABASE_PROJECT_ID=rjeuoheiayfzioqfdoom
ENVEOF

echo -e "${GREEN}✓ .env configurado para Supabase Cloud${NC}"

# Instalar dependências
echo -e "${YELLOW}Instalando dependências...${NC}"
npm install --legacy-peer-deps 2>&1 | tail -3
echo -e "${GREEN}✓ Dependências instaladas${NC}"

# Resultado
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Configuração concluída!                          ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}ANTES de iniciar, aplique o schema no Supabase:${NC}"
echo -e "${GREEN}║${NC}    1. Abra o SQL Editor no painel do Supabase"
echo -e "${GREEN}║${NC}    2. Cole o conteúdo de ${YELLOW}supabase-schema.sql${NC}"
echo -e "${GREEN}║${NC}    3. Clique em RUN"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}Configure Auth no Supabase:${NC}"
echo -e "${GREEN}║${NC}    Authentication → Settings → Site URL:"
echo -e "${GREEN}║${NC}    ${YELLOW}http://${HOST_IP}:${APP_PORT}${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}Iniciar frontend:${NC}"
echo -e "${GREEN}║${NC}    ${YELLOW}npx vite --host 0.0.0.0 --port ${APP_PORT}${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}Ou produção:${NC}"
echo -e "${GREEN}║${NC}    ${YELLOW}npx vite build && npx vite preview --host 0.0.0.0 --port ${APP_PORT}${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}Acessos:${NC}"
echo -e "${GREEN}║${NC}    Frontend: http://${HOST_IP}:${APP_PORT}"
echo -e "${GREEN}║${NC}    Login:    http://${HOST_IP}:${APP_PORT}/login"
echo -e "${GREEN}║${NC}    Totem:    http://${HOST_IP}:${APP_PORT}/totem"
echo -e "${GREEN}║${NC}    Painel:   http://${HOST_IP}:${APP_PORT}/panel"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
