#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  Instalador Offline — Sistema de Senhas
#  Backend (Supabase via Docker) + Frontend (Vite/React)
# ============================================================

# ── Cores ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${GREEN}[✔]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✘]${NC} $*"; exit 1; }
info() { echo -e "${CYAN}[i]${NC} $*"; }

# ── Configurações padrão (editáveis via flags) ───────────────
SUPABASE_PORT=54321
SUPABASE_DB_PORT=54322
SUPABASE_STUDIO_PORT=54323
FRONTEND_PORT=8080
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_NAME="$(basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/-/g')"
SKIP_DEPS=false
AUTO_YES=false

# ── Uso ──────────────────────────────────────────────────────
usage() {
  cat <<EOF
Uso: $0 [opções]

Opções:
  --api-port PORT        Porta da API Supabase        (padrão: $SUPABASE_PORT)
  --db-port PORT         Porta do PostgreSQL           (padrão: $SUPABASE_DB_PORT)
  --studio-port PORT     Porta do Supabase Studio      (padrão: $SUPABASE_STUDIO_PORT)
  --frontend-port PORT   Porta do frontend             (padrão: $FRONTEND_PORT)
  --project-name NAME    Nome do projeto Docker        (padrão: $PROJECT_NAME)
  --skip-deps            Não instalar dependências npm
  -y, --yes              Aceitar tudo automaticamente
  -h, --help             Mostrar esta ajuda
EOF
  exit 0
}

# ── Parse de argumentos ──────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --api-port)        SUPABASE_PORT="$2"; shift 2;;
    --db-port)         SUPABASE_DB_PORT="$2"; shift 2;;
    --studio-port)     SUPABASE_STUDIO_PORT="$2"; shift 2;;
    --frontend-port)   FRONTEND_PORT="$2"; shift 2;;
    --project-name)    PROJECT_NAME="$2"; shift 2;;
    --skip-deps)       SKIP_DEPS=true; shift;;
    -y|--yes)          AUTO_YES=true; shift;;
    -h|--help)         usage;;
    *)                 warn "Argumento desconhecido: $1"; shift;;
  esac
done

# ── Detectar IP externo ──────────────────────────────────────
detect_ip() {
  local ip=""
  # Tenta serviços externos primeiro
  for svc in "https://ifconfig.me" "https://api.ipify.org" "https://icanhazip.com"; do
    ip=$(curl -s --max-time 3 "$svc" 2>/dev/null | tr -d '[:space:]') && break
  done
  # Fallback: IP local da interface principal
  if [[ -z "$ip" || ! "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi
  if [[ -z "$ip" ]]; then
    ip="127.0.0.1"
  fi
  echo "$ip"
}

SERVER_IP=$(detect_ip)

# ── Resumo ───────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Instalação Offline — Sistema de Senhas         ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC} Projeto:      ${GREEN}$PROJECT_NAME${NC}"
echo -e "${CYAN}║${NC} IP do servidor: ${GREEN}$SERVER_IP${NC}"
echo -e "${CYAN}║${NC} API Supabase:  ${GREEN}http://$SERVER_IP:$SUPABASE_PORT${NC}"
echo -e "${CYAN}║${NC} PostgreSQL:    ${GREEN}$SERVER_IP:$SUPABASE_DB_PORT${NC}"
echo -e "${CYAN}║${NC} Studio:        ${GREEN}http://$SERVER_IP:$SUPABASE_STUDIO_PORT${NC}"
echo -e "${CYAN}║${NC} Frontend:      ${GREEN}http://$SERVER_IP:$FRONTEND_PORT${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

if [[ "$AUTO_YES" != true ]]; then
  read -rp "Continuar com a instalação? [S/n] " confirm
  [[ "${confirm,,}" =~ ^(n|não|nao|no)$ ]] && { info "Cancelado."; exit 0; }
fi

# ── Verificar dependências ───────────────────────────────────
check_cmd() {
  command -v "$1" &>/dev/null || err "$1 não encontrado. Instale antes de continuar."
}

info "Verificando dependências..."
check_cmd docker
check_cmd node
check_cmd npm

# Verificar Docker rodando
docker info &>/dev/null || err "Docker não está rodando. Execute: sudo systemctl start docker"

# Verificar Node.js >= 18
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
[[ "$NODE_VER" -ge 18 ]] || err "Node.js 18+ necessário (atual: v$NODE_VER)"

log "Dependências OK (Docker, Node.js v$(node -v), npm v$(npm -v))"

# ── Instalar Supabase CLI se necessário ──────────────────────
if ! command -v supabase &>/dev/null; then
  warn "Supabase CLI não encontrado. Instalando via npm..."
  npm install -g supabase
  log "Supabase CLI instalado"
else
  log "Supabase CLI já instalado ($(supabase --version 2>/dev/null || echo 'ok'))"
fi

# ── Instalar dependências npm ────────────────────────────────
cd "$PROJECT_DIR"

if [[ "$SKIP_DEPS" != true ]]; then
  info "Instalando dependências npm..."
  npm install
  log "Dependências npm instaladas"
else
  info "Pulando instalação de dependências (--skip-deps)"
fi

# ── Configurar portas customizadas no Supabase ───────────────
SUPABASE_CONFIG="$PROJECT_DIR/supabase/config.toml"

if [[ -f "$SUPABASE_CONFIG" ]]; then
  info "Configurando portas no supabase/config.toml..."

  # Garantir seção [api] com porta
  if grep -q '^\[api\]' "$SUPABASE_CONFIG"; then
    sed -i "s/^port = .*/port = $SUPABASE_PORT/" "$SUPABASE_CONFIG"
  else
    cat >> "$SUPABASE_CONFIG" <<EOF

[api]
port = $SUPABASE_PORT
EOF
  fi

  # Garantir seção [db] com porta
  if grep -q '^\[db\]' "$SUPABASE_CONFIG"; then
    sed -i "/^\[db\]/,/^\[/ s/^port = .*/port = $SUPABASE_DB_PORT/" "$SUPABASE_CONFIG"
  else
    cat >> "$SUPABASE_CONFIG" <<EOF

[db]
port = $SUPABASE_DB_PORT
EOF
  fi

  # Garantir seção [studio] com porta
  if grep -q '^\[studio\]' "$SUPABASE_CONFIG"; then
    sed -i "/^\[studio\]/,/^\[/ s/^port = .*/port = $SUPABASE_STUDIO_PORT/" "$SUPABASE_CONFIG"
  else
    cat >> "$SUPABASE_CONFIG" <<EOF

[studio]
port = $SUPABASE_STUDIO_PORT
EOF
  fi

  log "Portas configuradas"
fi

# ── Parar instância anterior (se existir) ────────────────────
info "Parando instância Supabase anterior (se houver)..."
supabase stop --project-id "$PROJECT_NAME" 2>/dev/null || true

# ── Iniciar Supabase Local ───────────────────────────────────
info "Iniciando Supabase local (primeira vez pode demorar ~2GB de download)..."
supabase start 2>&1 | tee /tmp/supabase-start.log

# Extrair anon key do output
ANON_KEY=$(supabase status 2>/dev/null | grep "anon key" | awk '{print $NF}' || echo "")
SERVICE_KEY=$(supabase status 2>/dev/null | grep "service_role key" | awk '{print $NF}' || echo "")
API_URL="http://$SERVER_IP:$SUPABASE_PORT"

if [[ -z "$ANON_KEY" ]]; then
  warn "Não foi possível extrair anon key automaticamente."
  warn "Execute 'supabase status' e copie a anon key manualmente."
  read -rp "Cole a anon key: " ANON_KEY
fi

log "Supabase rodando!"
info "Anon key: ${ANON_KEY:0:20}..."

# ── Aplicar migrações ────────────────────────────────────────
info "Aplicando migrações do banco de dados..."
supabase db reset --linked=false 2>&1 || {
  warn "db reset falhou, tentando push..."
  supabase db push 2>/dev/null || warn "Migrações podem precisar ser aplicadas manualmente"
}
log "Banco de dados configurado"

# ── Criar arquivo .env ───────────────────────────────────────
info "Gerando arquivo .env..."
cat > "$PROJECT_DIR/.env" <<EOF
VITE_SUPABASE_URL=$API_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
VITE_SUPABASE_PROJECT_ID=local
EOF
log "Arquivo .env criado"

# ── Criar arquivo .env para Edge Functions ───────────────────
mkdir -p "$PROJECT_DIR/supabase/functions"
cat > "$PROJECT_DIR/supabase/.env" <<EOF
SUPABASE_URL=$API_URL
SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
EOF
log "Variáveis de ambiente para Edge Functions configuradas"

# ── Gerar script de inicialização ────────────────────────────
cat > "$PROJECT_DIR/start.sh" <<STARTEOF
#!/usr/bin/env bash
set -euo pipefail

cd "$PROJECT_DIR"

SERVER_IP=\$(curl -s --max-time 3 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print \$1}')

echo ""
echo -e "\033[0;36m╔══════════════════════════════════════════════════╗\033[0m"
echo -e "\033[0;36m║   Sistema de Senhas — Inicialização               ║\033[0m"
echo -e "\033[0;36m╠══════════════════════════════════════════════════╣\033[0m"
echo -e "\033[0;36m║\033[0m IP: \033[0;32m\$SERVER_IP\033[0m"
echo -e "\033[0;36m║\033[0m API:     \033[0;32mhttp://\$SERVER_IP:$SUPABASE_PORT\033[0m"
echo -e "\033[0;36m║\033[0m Studio:  \033[0;32mhttp://\$SERVER_IP:$SUPABASE_STUDIO_PORT\033[0m"
echo -e "\033[0;36m║\033[0m Frontend:\033[0;32mhttp://\$SERVER_IP:$FRONTEND_PORT\033[0m"
echo -e "\033[0;36m╚══════════════════════════════════════════════════╝\033[0m"
echo ""

# Iniciar Supabase
echo "[1/3] Iniciando backend..."
supabase start

# Edge Functions em background
echo "[2/3] Iniciando Edge Functions..."
supabase functions serve &
EDGE_PID=\$!

# Frontend
echo "[3/3] Iniciando frontend..."
npx vite --host 0.0.0.0 --port $FRONTEND_PORT &
VITE_PID=\$!

cleanup() {
  echo "Parando serviços..."
  kill \$EDGE_PID 2>/dev/null || true
  kill \$VITE_PID 2>/dev/null || true
  supabase stop 2>/dev/null || true
  echo "Parado."
}
trap cleanup EXIT INT TERM

echo ""
echo "Sistema rodando. Pressione Ctrl+C para parar."
wait
STARTEOF

chmod +x "$PROJECT_DIR/start.sh"
log "Script start.sh criado"

# ── Gerar script de parada ───────────────────────────────────
cat > "$PROJECT_DIR/stop.sh" <<STOPEOF
#!/usr/bin/env bash
cd "$PROJECT_DIR"
echo "Parando serviços..."
pkill -f "vite.*--port $FRONTEND_PORT" 2>/dev/null || true
pkill -f "supabase functions serve" 2>/dev/null || true
supabase stop 2>/dev/null || true
echo "Todos os serviços parados."
STOPEOF

chmod +x "$PROJECT_DIR/stop.sh"
log "Script stop.sh criado"

# ── Gerar docker-compose alternativo (tudo em Docker) ────────
cat > "$PROJECT_DIR/docker-compose.yml" <<DCEOF
# Docker Compose alternativo para rodar o frontend em container
# O backend Supabase já roda via 'supabase start' (Docker interno)
# Use este compose apenas se quiser o frontend também em Docker

version: '3.8'

services:
  frontend:
    container_name: ${PROJECT_NAME}-frontend
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${FRONTEND_PORT}:${FRONTEND_PORT}"
    environment:
      - VITE_SUPABASE_URL=http://host.docker.internal:${SUPABASE_PORT}
      - VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
      - VITE_SUPABASE_PROJECT_ID=local
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped
DCEOF

# ── Dockerfile para frontend ────────────────────────────────
cat > "$PROJECT_DIR/Dockerfile" <<DKEOF
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID=local
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE ${FRONTEND_PORT}
CMD ["nginx", "-g", "daemon off;"]
DKEOF

# ── Nginx config ─────────────────────────────────────────────
cat > "$PROJECT_DIR/nginx.conf" <<NGEOF
server {
    listen ${FRONTEND_PORT};
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGEOF

log "Dockerfile e docker-compose.yml criados"

# ── Resultado final ──────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ Instalação concluída com sucesso!            ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC} ${CYAN}Para iniciar tudo:${NC}"
echo -e "${GREEN}║${NC}   ./start.sh"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC} ${CYAN}Para parar tudo:${NC}"
echo -e "${GREEN}║${NC}   ./stop.sh"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC} ${CYAN}Ou via Docker Compose (frontend containerizado):${NC}"
echo -e "${GREEN}║${NC}   docker compose up -d"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC} ${CYAN}URLs:${NC}"
echo -e "${GREEN}║${NC}   Frontend:  ${GREEN}http://$SERVER_IP:$FRONTEND_PORT${NC}"
echo -e "${GREEN}║${NC}   API:       ${GREEN}http://$SERVER_IP:$SUPABASE_PORT${NC}"
echo -e "${GREEN}║${NC}   Studio:    ${GREEN}http://$SERVER_IP:$SUPABASE_STUDIO_PORT${NC}"
echo -e "${GREEN}║${NC}   DB:        ${GREEN}postgresql://postgres:postgres@$SERVER_IP:$SUPABASE_DB_PORT/postgres${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC} ${CYAN}Criar admin:${NC}"
echo -e "${GREEN}║${NC}   Acesse http://$SERVER_IP:$FRONTEND_PORT/setup-admin"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
