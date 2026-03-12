#!/bin/bash
# ============================================================
# update.sh — Atualiza o sistema (git pull + build + restart)
# Uso: bash update.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║  🔄 Atualizando Sistema                          ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# 1. Parar serviços
echo -e "${YELLOW}[1/5] Parando serviços...${NC}"
if [ -f "stop.sh" ]; then
  bash stop.sh 2>/dev/null || true
elif command -v pm2 &>/dev/null; then
  pm2 stop senhas-frontend 2>/dev/null || true
fi
echo -e "${GREEN}✓ Serviços parados${NC}"

# 2. Atualizar código
echo -e "${YELLOW}[2/5] Atualizando código...${NC}"
git pull --ff-only 2>&1 || {
  echo -e "${RED}✗ git pull falhou. Tente: git stash && git pull && git stash pop${NC}"
  exit 1
}
echo -e "${GREEN}✓ Código atualizado${NC}"

# 3. Instalar dependências
echo -e "${YELLOW}[3/5] Instalando dependências...${NC}"
npm install --legacy-peer-deps 2>&1 | tail -3
echo -e "${GREEN}✓ Dependências instaladas${NC}"

# 4. Build
echo -e "${YELLOW}[4/5] Compilando...${NC}"
npx vite build 2>&1 | tail -5
echo -e "${GREEN}✓ Build concluído${NC}"

# 5. Reiniciar
echo -e "${YELLOW}[5/5] Reiniciando serviços...${NC}"
if command -v pm2 &>/dev/null; then
  pm2 restart senhas-frontend 2>/dev/null || pm2 start ecosystem.config.cjs
  echo -e "${GREEN}✓ Reiniciado via PM2${NC}"
elif [ -f "start.sh" ]; then
  bash start.sh --production
  echo -e "${GREEN}✓ Reiniciado via start.sh${NC}"
else
  echo -e "${YELLOW}⚠ Inicie manualmente: npx vite preview --host 0.0.0.0 --port 3001${NC}"
fi

echo ""
echo -e "${GREEN}✅ Atualização concluída!${NC}"
