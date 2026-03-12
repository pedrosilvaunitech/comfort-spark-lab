#!/bin/bash
# ============================================================
# local.sh — Clona, configura e inicia o sistema localmente
# Uso: bash local.sh [--repo URL] [--port 3001] [--gateway 54321]
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

# Defaults
REPO_URL=""
APP_PORT=3001
GATEWAY_PORT=54321
PROJECT_DIR=""
JWT_SECRET=""

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --repo) REPO_URL="$2"; shift 2 ;;
    --port) APP_PORT="$2"; shift 2 ;;
    --gateway) GATEWAY_PORT="$2"; shift 2 ;;
    --dir) PROJECT_DIR="$2"; shift 2 ;;
    --jwt-secret) JWT_SECRET="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   🚀 Instalação Local - UniTechBR Senhas        ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ============================================================
# 1. Detectar IP da rede
# ============================================================
echo -e "${YELLOW}[1/7] Detectando IP da rede...${NC}"
HOST_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[\d.]+' | head -1)
if [ -z "$HOST_IP" ]; then
  HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [ -z "$HOST_IP" ]; then
  HOST_IP="127.0.0.1"
fi
echo -e "${GREEN}✓ IP detectado: ${HOST_IP}${NC}"

# ============================================================
# 2. Verificar dependências do sistema
# ============================================================
echo -e "${YELLOW}[2/7] Verificando dependências...${NC}"

check_cmd() {
  if command -v "$1" &>/dev/null; then
    echo -e "  ${GREEN}✓ $1 encontrado${NC}"
    return 0
  else
    echo -e "  ${RED}✗ $1 não encontrado${NC}"
    return 1
  fi
}

MISSING=0
check_cmd node || MISSING=1
check_cmd npm || MISSING=1
check_cmd git || MISSING=1

if [ "$MISSING" -eq 1 ]; then
  echo -e "${RED}Instale as dependências faltantes antes de continuar:${NC}"
  echo -e "  ${CYAN}sudo apt update && sudo apt install -y nodejs npm git${NC}"
  echo -e "  ${CYAN}Ou use: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs${NC}"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}✗ Node.js 18+ necessário (atual: $(node -v))${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v) OK${NC}"

# ============================================================
# 3. Clonar repositório (se necessário)
# ============================================================
echo -e "${YELLOW}[3/7] Preparando projeto...${NC}"

if [ -n "$REPO_URL" ]; then
  FOLDER_NAME=$(basename "$REPO_URL" .git)
  PROJECT_DIR="${PROJECT_DIR:-$FOLDER_NAME}"

  if [ -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}  Pasta '$PROJECT_DIR' já existe. Atualizando...${NC}"
    cd "$PROJECT_DIR"
    git pull --ff-only 2>/dev/null || echo -e "${YELLOW}  ⚠ git pull falhou, continuando com código atual${NC}"
  else
    echo -e "${CYAN}  Clonando $REPO_URL...${NC}"
    git clone "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
  fi
else
  # Se já está dentro do projeto
  if [ -f "package.json" ]; then
    PROJECT_DIR="$(pwd)"
    echo -e "${GREEN}✓ Usando diretório atual: $PROJECT_DIR${NC}"
  else
    echo -e "${RED}✗ Nenhum --repo fornecido e não estamos dentro de um projeto.${NC}"
    echo -e "${CYAN}  Uso: bash local.sh --repo https://github.com/SEU_USUARIO/SEU_REPO.git${NC}"
    exit 1
  fi
fi

# ============================================================
# 4. Instalar dependências Node
# ============================================================
echo -e "${YELLOW}[4/7] Instalando dependências npm...${NC}"
npm install --legacy-peer-deps 2>&1 | tail -5
echo -e "${GREEN}✓ Dependências instaladas${NC}"

# ============================================================
# 5. Configurar .env local
# ============================================================
echo -e "${YELLOW}[5/7] Configurando .env para ambiente local...${NC}"

# Se não passou --jwt-secret, perguntar ou usar default
if [ -z "$JWT_SECRET" ]; then
  echo -e "${CYAN}  Informe o JWT_SECRET do seu PostgREST/GoTrue local${NC}"
  echo -e "${CYAN}  (ou pressione Enter para usar o padrão: super-secret-jwt-token-with-at-least-32-characters):${NC}"
  read -r INPUT_SECRET
  if [ -n "$INPUT_SECRET" ]; then
    JWT_SECRET="$INPUT_SECRET"
  else
    JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters"
  fi
fi

echo -e "${YELLOW}  Gerando anon key local com JWT_SECRET fornecido...${NC}"

# Gerar anon key JWT usando Node.js (compatível com o JWT_SECRET local)
ANON_KEY=$(node -e "
const crypto = require('crypto');
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  iss:'supabase',
  ref:'local',
  role:'anon',
  iat:Math.floor(Date.now()/1000),
  exp:Math.floor(Date.now()/1000)+315360000
})).toString('base64url');
const sig = crypto.createHmac('sha256','${JWT_SECRET}').update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+sig);
")

# Gerar service_role key também (necessário para edge functions)
SERVICE_KEY=$(node -e "
const crypto = require('crypto');
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  iss:'supabase',
  ref:'local',
  role:'service_role',
  iat:Math.floor(Date.now()/1000),
  exp:Math.floor(Date.now()/1000)+315360000
})).toString('base64url');
const sig = crypto.createHmac('sha256','${JWT_SECRET}').update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+sig);
")

echo -e "${GREEN}✓ Anon key gerada com sucesso${NC}"

# Backup do .env existente
if [ -f ".env" ]; then
  cp .env ".env.backup.$(date +%Y%m%d%H%M%S)"
fi

cat > .env << ENVEOF
# Gerado por local.sh em $(date)
# Modo: 100% LOCAL
VITE_SUPABASE_URL=http://${HOST_IP}:${GATEWAY_PORT}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=local
ENVEOF

echo -e "${GREEN}✓ .env configurado para modo LOCAL:${NC}"
echo -e "  VITE_SUPABASE_URL=http://${HOST_IP}:${GATEWAY_PORT}"
echo -e "  ANON_KEY=${ANON_KEY:0:40}..."
echo ""
echo -e "${CYAN}  ╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}  ║  Salve estas chaves para seu GoTrue/PostgREST:${NC}"
echo -e "${CYAN}  ║  JWT_SECRET=${JWT_SECRET}${NC}"
echo -e "${CYAN}  ║  ANON_KEY=${ANON_KEY}${NC}"
echo -e "${CYAN}  ║  SERVICE_ROLE_KEY=${SERVICE_KEY}${NC}"
echo -e "${CYAN}  ╚══════════════════════════════════════════════╝${NC}"

# ============================================================
# 6. Build do frontend
# ============================================================
echo -e "${YELLOW}[6/7] Compilando frontend...${NC}"
npx vite build 2>&1 | tail -5
echo -e "${GREEN}✓ Build concluído${NC}"

# ============================================================
# 7. Iniciar proxy gateway + frontend
# ============================================================
echo -e "${YELLOW}[7/7] Iniciando serviços...${NC}"

mkdir -p logs

# Parar processos anteriores
if [ -f ".proxy.pid" ]; then
  kill $(cat .proxy.pid) 2>/dev/null || true
  rm -f .proxy.pid
fi
if [ -f ".frontend.pid" ]; then
  kill $(cat .frontend.pid) 2>/dev/null || true
  rm -f .frontend.pid
fi
lsof -ti:${APP_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:${GATEWAY_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true

# Iniciar proxy gateway
if [ -f "proxy-gateway.mjs" ]; then
  echo -e "${CYAN}  Iniciando proxy gateway na porta ${GATEWAY_PORT}...${NC}"
  nohup node proxy-gateway.mjs ${GATEWAY_PORT} >> logs/proxy.log 2>&1 &
  echo $! > .proxy.pid
  sleep 1
  if kill -0 $(cat .proxy.pid) 2>/dev/null; then
    echo -e "${GREEN}  ✓ Proxy gateway rodando (PID: $(cat .proxy.pid))${NC}"
  else
    echo -e "${RED}  ✗ Falha ao iniciar proxy. Veja logs/proxy.log${NC}"
    exit 1
  fi
else
  echo -e "${RED}  ✗ proxy-gateway.mjs não encontrado!${NC}"
  exit 1
fi

# Iniciar frontend (produção)
echo -e "${CYAN}  Iniciando frontend na porta ${APP_PORT}...${NC}"
nohup npx vite preview --host 0.0.0.0 --port ${APP_PORT} >> logs/frontend.log 2>&1 &
echo $! > .frontend.pid
sleep 2

if kill -0 $(cat .frontend.pid) 2>/dev/null; then
  echo -e "${GREEN}  ✓ Frontend rodando (PID: $(cat .frontend.pid))${NC}"
else
  echo -e "${RED}  ✗ Falha ao iniciar frontend. Veja logs/frontend.log${NC}"
  exit 1
fi

# ============================================================
# Resultado final
# ============================================================
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Sistema instalado e rodando!${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC}  ${GREEN}http://${HOST_IP}:${APP_PORT}${NC}"
echo -e "  ${CYAN}Gateway:${NC}   ${GREEN}http://${HOST_IP}:${GATEWAY_PORT}${NC}"
echo -e "  ${CYAN}Painel:${NC}    ${GREEN}http://${HOST_IP}:${APP_PORT}/totem${NC}"
echo -e "  ${CYAN}Admin:${NC}     ${GREEN}http://${HOST_IP}:${APP_PORT}/admin${NC}"
echo -e "  ${CYAN}Login:${NC}     ${GREEN}http://${HOST_IP}:${APP_PORT}/login${NC}"
echo ""
echo -e "  ${CYAN}Logs:${NC}      tail -f logs/frontend.log"
echo -e "             tail -f logs/proxy.log"
echo -e "  ${CYAN}Parar:${NC}     bash stop.sh"
echo -e "${CYAN}════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}⚠ IMPORTANTE: O backend (GoTrue + PostgREST) deve estar${NC}"
echo -e "${YELLOW}  rodando nas portas 9999 e 3000 respectivamente.${NC}"
echo -e "${YELLOW}  Sem eles, autenticação e dados não funcionarão.${NC}"
