#!/bin/bash
# ============================================================
# deploy-linux.sh — Build completo + PM2 para produção Linux
# Uso: bash deploy-linux.sh [--port 3001]
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_PORT=3001

while [[ $# -gt 0 ]]; do
  case $1 in
    --port) APP_PORT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   🚀 Deploy Linux — Build + PM2 Produção        ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# 1. Verificar Node.js
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js não encontrado. Instale: https://nodejs.org/${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# 2. Instalar dependências
echo -e "${YELLOW}[1/5] Instalando dependências...${NC}"
npm install --legacy-peer-deps

# 3. Build produção
echo -e "${YELLOW}[2/5] Compilando para produção...${NC}"
npm run build
echo -e "${GREEN}✓ Build concluído (dist/)${NC}"

# 4. Instalar PM2
if ! command -v pm2 &>/dev/null; then
  echo -e "${YELLOW}[3/5] Instalando PM2...${NC}"
  npm install -g pm2
else
  echo -e "${GREEN}[3/5] PM2 já instalado${NC}"
fi

# 5. Atualizar porta no ecosystem se diferente
if [ "$APP_PORT" != "3001" ]; then
  sed -i "s/--port 3001/--port ${APP_PORT}/g" ecosystem.config.cjs
  echo -e "${GREEN}✓ Porta atualizada para ${APP_PORT}${NC}"
fi

# 6. Iniciar/Reiniciar PM2
echo -e "${YELLOW}[4/5] Iniciando PM2...${NC}"
mkdir -p logs
pm2 delete senhas-frontend 2>/dev/null || true
pm2 start ecosystem.config.cjs
echo -e "${GREEN}✓ PM2 iniciado${NC}"

# 7. Auto-start no boot
echo -e "${YELLOW}[5/5] Configurando auto-start...${NC}"
pm2 save
pm2 startup 2>/dev/null || echo -e "${YELLOW}⚠ Execute o comando pm2 startup manualmente como root${NC}"

# Detectar IP
HOST_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[\d.]+' | head -1)
[ -z "$HOST_IP" ] && HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$HOST_IP" ] && HOST_IP="127.0.0.1"

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Deploy concluído!${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC} http://${HOST_IP}:${APP_PORT}"
echo -e "  ${CYAN}Totem:${NC}    http://${HOST_IP}:${APP_PORT}/totem"
echo -e "  ${CYAN}Painel:${NC}   http://${HOST_IP}:${APP_PORT}/panel"
echo -e "  ${CYAN}Admin:${NC}    http://${HOST_IP}:${APP_PORT}/admin"
echo ""
echo -e "  ${CYAN}Comandos:${NC}"
echo -e "    pm2 status              — Ver status"
echo -e "    pm2 logs senhas-frontend — Ver logs"
echo -e "    pm2 restart senhas-frontend — Reiniciar"
echo -e "    bash update.sh          — Atualizar"
echo -e "${CYAN}════════════════════════════════════════════════════${NC}"
