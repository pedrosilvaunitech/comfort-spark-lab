#!/bin/bash
set -e

# ============================================================
# Setup Local — Sistema de Senhas (Painel de Chamadas)
# Backend completo via Docker (PostgreSQL + GoTrue + PostgREST + Kong + Edge Functions)
#
# Uso: bash setup-local.sh [opções]
#
# Opções:
#   --name <nome>        Nome do projeto (default: nome da pasta)
#   --db-port <porta>    Porta do PostgreSQL (default: 54320)
#   --api-port <porta>   Porta do API Gateway (default: 54321)
#   --app-port <porta>   Porta do Frontend (default: 3001)
#   --host <ip>          IP do servidor (default: auto-detectado)
#   --password <senha>   Senha do banco (default: gerada automaticamente)
#   --jwt-secret <chave> JWT secret (default: gerada automaticamente)
#   --skip-docker        Não subir containers Docker
#   --skip-npm           Não instalar dependências npm
#   --production         Compilar para produção
#   -y, --yes            Aceitar tudo automaticamente
# ============================================================

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Defaults
PROJECT_NAME=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
DB_PORT=54320
API_PORT=54321
APP_PORT=3001
HOST_IP=""
POSTGRES_PASSWORD=""
JWT_SECRET=""
SKIP_DOCKER=false
SKIP_NPM=false
PRODUCTION=false
AUTO_YES=false

# Parse argumentos
while [[ $# -gt 0 ]]; do
  case $1 in
    --name) PROJECT_NAME="$2"; shift 2 ;;
    --db-port) DB_PORT="$2"; shift 2 ;;
    --api-port) API_PORT="$2"; shift 2 ;;
    --app-port) APP_PORT="$2"; shift 2 ;;
    --host) HOST_IP="$2"; shift 2 ;;
    --password) POSTGRES_PASSWORD="$2"; shift 2 ;;
    --jwt-secret) JWT_SECRET="$2"; shift 2 ;;
    --skip-docker) SKIP_DOCKER=true; shift ;;
    --skip-npm) SKIP_NPM=true; shift ;;
    --production) PRODUCTION=true; shift ;;
    -y|--yes) AUTO_YES=true; shift ;;
    -h|--help)
      sed -n '3,16p' "$0" | sed 's/^# //' | sed 's/^#//'
      exit 0 ;;
    *) echo -e "${RED}Opção desconhecida: $1${NC}"; exit 1 ;;
  esac
done

# Auto-detectar IP da rede interna (LAN) se não fornecido
if [ -z "$HOST_IP" ]; then
  # Método 1: ip route (mais confiável no Linux)
  HOST_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[\d.]+' | head -1)
  # Método 2: hostname -I
  if [ -z "$HOST_IP" ] || ! [[ "$HOST_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi
  # Método 3: ifconfig (compatibilidade)
  if [ -z "$HOST_IP" ] || ! [[ "$HOST_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    HOST_IP=$(ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1 | awk '{print $NF}')
  fi
  # Fallback
  if [ -z "$HOST_IP" ] || ! [[ "$HOST_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    HOST_IP="127.0.0.1"
  fi
  echo -e "${GREEN}✓ IP da rede interna detectado: ${HOST_IP}${NC}"
fi

# Gerar senha se não fornecida
if [ -z "$POSTGRES_PASSWORD" ]; then
  POSTGRES_PASSWORD=$(openssl rand -hex 16 2>/dev/null || echo "${PROJECT_NAME}_secret_$(date +%s)")
fi

# Gerar JWT secret se não fornecido
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -base64 48 2>/dev/null || echo "super-secret-jwt-token-with-at-least-32-characters-long-$(date +%s)")
fi

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   🏥 Setup Local — Sistema de Senhas             ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "${BLUE}Projeto:${NC}  $PROJECT_NAME"
echo -e "${BLUE}Host:${NC}     $HOST_IP"
echo -e "${BLUE}DB:${NC}       $HOST_IP:$DB_PORT"
echo -e "${BLUE}API:${NC}      http://$HOST_IP:$API_PORT"
echo -e "${BLUE}App:${NC}      http://$HOST_IP:$APP_PORT"
echo ""

if [[ "$AUTO_YES" != true ]]; then
  read -rp "Continuar com a instalação? [S/n] " confirm
  [[ "${confirm,,}" =~ ^(n|não|nao|no)$ ]] && { echo "Cancelado."; exit 0; }
fi

# ============================================================
# 1. Verificar dependências
# ============================================================
echo -e "${YELLOW}[1/8] Verificando dependências...${NC}"

check_cmd() {
  if ! command -v $1 &> /dev/null; then
    echo -e "${RED}✗ $1 não encontrado. Instale antes de continuar.${NC}"
    echo "  $2"
    exit 1
  else
    echo -e "${GREEN}✓ $1 encontrado${NC}"
  fi
}

check_cmd "docker" "curl -fsSL https://get.docker.com | sh"
check_cmd "node" "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && nvm install 18"
check_cmd "npm" "Instalado junto com o Node.js"

if ! docker info &> /dev/null; then
  echo -e "${RED}✗ Docker não está rodando. Execute: sudo systemctl start docker${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker está rodando${NC}"

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
[[ "$NODE_VER" -ge 18 ]] || { echo -e "${RED}✗ Node.js 18+ necessário (atual: v$NODE_VER)${NC}"; exit 1; }

# ============================================================
# 2. Criar estrutura de diretórios
# ============================================================
echo ""
echo -e "${YELLOW}[2/8] Criando estrutura de diretórios...${NC}"

mkdir -p docker
mkdir -p supabase/functions/main

echo -e "${GREEN}✓ Diretórios criados${NC}"

# ============================================================
# 3. Gerar chaves JWT
# ============================================================
echo ""
echo -e "${YELLOW}[3/8] Gerando chaves JWT...${NC}"

ANON_KEY=$(node -e "
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  iss:'supabase-local',
  ref:'${PROJECT_NAME}',
  role:'anon',
  iat:Math.floor(Date.now()/1000),
  exp:Math.floor(Date.now()/1000)+315360000
})).toString('base64url');
const crypto = require('crypto');
const sig = crypto.createHmac('sha256','${JWT_SECRET}').update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+sig);
")

SERVICE_ROLE_KEY=$(node -e "
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  iss:'supabase-local',
  ref:'${PROJECT_NAME}',
  role:'service_role',
  iat:Math.floor(Date.now()/1000),
  exp:Math.floor(Date.now()/1000)+315360000
})).toString('base64url');
const crypto = require('crypto');
const sig = crypto.createHmac('sha256','${JWT_SECRET}').update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+sig);
")

echo -e "${GREEN}✓ ANON_KEY gerada${NC}"
echo -e "${GREEN}✓ SERVICE_ROLE_KEY gerada${NC}"

# ============================================================
# 4. Criar SQL de inicialização dos roles do Postgres
# ============================================================
echo ""
echo -e "${YELLOW}[4/8] Criando SQL de inicialização...${NC}"

cat > docker/init-db.sql << INITSQL_EOF
-- ============================================================
-- Complemento de roles para Supabase local
-- A imagem supabase/postgres já cria os roles base.
-- Este script configura authenticator e supabase_auth_admin.
-- ============================================================

DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
END
\$\$;
ALTER ROLE authenticator PASSWORD '${POSTGRES_PASSWORD}';

DO \$\$
BEGIN
  EXECUTE 'GRANT anon TO authenticator';
  EXECUTE 'GRANT authenticated TO authenticator';
  EXECUTE 'GRANT service_role TO authenticator';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Grants pendentes (init-scripts da imagem)';
END
\$\$;

DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOINHERIT CREATEROLE LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
END
\$\$;
ALTER ROLE supabase_auth_admin PASSWORD '${POSTGRES_PASSWORD}';

GRANT ALL ON SCHEMA public TO supabase_auth_admin;
GRANT CREATE ON SCHEMA public TO supabase_auth_admin;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;

DO \$\$ BEGIN RAISE NOTICE '✅ Roles complementares inicializados!'; END \$\$;
INITSQL_EOF

echo -e "${GREEN}✓ docker/init-db.sql criado${NC}"

# ============================================================
# 5. Criar Kong config
# ============================================================
echo ""
echo -e "${YELLOW}[5/8] Criando configuração do Kong...${NC}"

cat > docker/kong.yml << KONG_EOF
_format_version: "2.1"
_transform: true

services:
  - name: rest-v1
    url: http://rest:3000/
    routes:
      - name: rest-v1
        strip_path: true
        paths:
          - /rest/v1/
    plugins:
      - name: cors
        config:
          origins: ["*"]
          methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
          headers: [Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Auth-Token, Authorization, apikey, x-client-info]
          exposed_headers: [X-Total-Count]
          credentials: true
          max_age: 3600
      - name: key-auth
        config:
          hide_credentials: false
          key_names: [apikey]

  - name: auth-v1
    url: http://auth:9999/
    routes:
      - name: auth-v1
        strip_path: true
        paths:
          - /auth/v1/
    plugins:
      - name: cors
        config:
          origins: ["*"]
          methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
          headers: [Accept, Content-Type, Authorization, apikey, x-client-info]
          credentials: true
          max_age: 3600

  - name: functions-v1
    url: http://functions:9000/
    routes:
      - name: functions-v1
        strip_path: true
        paths:
          - /functions/v1/
    plugins:
      - name: cors
        config:
          origins: ["*"]
          methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
          headers: [Accept, Content-Type, Authorization, apikey, x-client-info]
          credentials: true
          max_age: 3600

consumers:
  - username: anon
    keyauth_credentials:
      - key: ${ANON_KEY}
  - username: service_role
    keyauth_credentials:
      - key: ${SERVICE_ROLE_KEY}
KONG_EOF

echo -e "${GREEN}✓ docker/kong.yml criado${NC}"

# ============================================================
# 6. Criar entry point das Edge Functions
# ============================================================
echo ""
echo -e "${YELLOW}[6/8] Criando entry point das Edge Functions...${NC}"

if [ ! -f "supabase/functions/main/index.ts" ]; then
  cat > supabase/functions/main/index.ts << 'MAIN_EOF'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/" || path === "/health") {
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const functionName = path.split("/").filter(Boolean)[0];

  if (functionName) {
    try {
      const module = await import(`../${functionName}/index.ts`);
      if (typeof module.default === "function") {
        return module.default(req);
      }
    } catch (e) {
      // Function not found
    }
  }

  return new Response(JSON.stringify({ error: "Function not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
});
MAIN_EOF
  echo -e "${GREEN}✓ supabase/functions/main/index.ts criado${NC}"
else
  echo -e "${GREEN}✓ supabase/functions/main/index.ts já existe${NC}"
fi

# ============================================================
# 7. Criar docker-compose.yml
# ============================================================
echo ""
echo -e "${YELLOW}[7/8] Criando docker-compose.yml...${NC}"

cat > docker-compose.yml << COMPOSE_EOF
# ${PROJECT_NAME} - Deploy Local Completo
# Gerado por setup-local.sh em $(date)

services:
  # ── PostgreSQL ──────────────────────────────────────────────
  db:
    image: supabase/postgres:15.6.1.143
    container_name: ${PROJECT_NAME}-db
    restart: unless-stopped
    ports:
      - "${DB_PORT}:5432"
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: postgres
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXP: 3600
    volumes:
      - ${PROJECT_NAME}-db-data:/var/lib/postgresql/data
      - ./docker/init-db.sql:/docker-entrypoint-initdb.d/00-init-roles.sql:ro
    healthcheck:
      test: pg_isready -U supabase_admin -d postgres -h localhost
      interval: 5s
      timeout: 10s
      retries: 20
      start_period: 30s

  # ── GoTrue (Auth) ──────────────────────────────────────────
  auth:
    image: supabase/gotrue:v2.158.1
    container_name: ${PROJECT_NAME}-auth
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: http://${HOST_IP}:${API_PORT}
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@db:5432/postgres
      GOTRUE_SITE_URL: http://${HOST_IP}:${APP_PORT}
      GOTRUE_URI_ALLOW_LIST: ""
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_EXP: 3600
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_MAILER_AUTOCONFIRM: "true"
      GOTRUE_SMTP_ADMIN_EMAIL: admin@${PROJECT_NAME}.local
      GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED: "true"
      GOTRUE_LOG_LEVEL: warn

  # ── PostgREST (API REST) ───────────────────────────────────
  rest:
    image: postgrest/postgrest:v12.2.3
    container_name: ${PROJECT_NAME}-rest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      PGRST_DB_URI: postgres://authenticator:${POSTGRES_PASSWORD}@db:5432/postgres
      PGRST_DB_SCHEMAS: public,storage
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET}
      PGRST_DB_USE_LEGACY_GUCS: "false"
      PGRST_APP_SETTINGS_JWT_SECRET: ${JWT_SECRET}
      PGRST_APP_SETTINGS_JWT_EXP: 3600

  # ── Kong (API Gateway) ─────────────────────────────────────
  kong:
    image: kong:2.8.1
    container_name: ${PROJECT_NAME}-kong
    restart: unless-stopped
    ports:
      - "${API_PORT}:8000"
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl,basic-auth
      KONG_NGINX_PROXY_PROXY_BUFFER_SIZE: 160k
      KONG_NGINX_PROXY_PROXY_BUFFERS: 64 160k
    volumes:
      - ./docker/kong.yml:/var/lib/kong/kong.yml:ro
    depends_on:
      - auth
      - rest

  # ── Edge Functions (Deno Runtime) ──────────────────────────
  functions:
    image: supabase/edge-runtime:v1.65.3
    container_name: ${PROJECT_NAME}-functions
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      JWT_SECRET: ${JWT_SECRET}
      SUPABASE_URL: http://kong:8000
      SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}
      SUPABASE_DB_URL: postgres://postgres:${POSTGRES_PASSWORD}@db:5432/postgres
      VERIFY_JWT: "false"
    volumes:
      - ./supabase/functions:/home/deno/functions:ro
    extra_hosts:
      - "host.docker.internal:host-gateway"
    command:
      - start
      - --main-service
      - /home/deno/functions/main

volumes:
  ${PROJECT_NAME}-db-data:
    driver: local
COMPOSE_EOF

echo -e "${GREEN}✓ docker-compose.yml criado${NC}"

# ============================================================
# 8. Criar .env e subir tudo
# ============================================================
echo ""
echo -e "${YELLOW}[8/8] Configurando ambiente...${NC}"

cat > .env.local << ENV_EOF
# ${PROJECT_NAME} - Variáveis Locais
# Gerado em: $(date)

POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_PORT=${DB_PORT}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
KONG_HTTP_PORT=${API_PORT}
HOST_IP=${HOST_IP}
SITE_URL=http://${HOST_IP}:${APP_PORT}
API_EXTERNAL_URL=http://${HOST_IP}:${API_PORT}

# Frontend (Vite)
VITE_SUPABASE_URL=http://${HOST_IP}:${API_PORT}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=${PROJECT_NAME}
VITE_PORT=${APP_PORT}
ENV_EOF

# Criar .env para o Vite
cat > .env << VITEENV_EOF
VITE_SUPABASE_URL=http://${HOST_IP}:${API_PORT}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=${PROJECT_NAME}
VITEENV_EOF

echo -e "${GREEN}✓ .env.local e .env criados${NC}"

# ============================================================
# Subir Docker e aplicar schema
# ============================================================
if [ "$SKIP_DOCKER" = false ]; then
  echo ""
  echo -e "${YELLOW}Subindo containers Docker...${NC}"

  docker compose down 2>/dev/null || true
  docker compose up -d

  echo -e "${GREEN}✓ Containers iniciados${NC}"
  echo ""
  docker compose ps

  # Aguardar banco
  echo ""
  echo -e "${YELLOW}Aguardando banco ficar pronto...${NC}"
  RETRIES=0
  MAX_RETRIES=30
  until docker exec ${PROJECT_NAME}-db pg_isready -U supabase_admin -d postgres -h localhost > /dev/null 2>&1; do
    RETRIES=$((RETRIES + 1))
    if [ $RETRIES -ge $MAX_RETRIES ]; then
      echo -e "${RED}✗ Banco não ficou pronto após ${MAX_RETRIES} tentativas${NC}"
      echo -e "${YELLOW}Verifique: docker compose logs db${NC}"
      break
    fi
    sleep 2
  done

  if [ $RETRIES -lt $MAX_RETRIES ]; then
    echo -e "${GREEN}✓ Banco pronto!${NC}"

    # Garantir roles
    echo -e "${YELLOW}Garantindo roles do banco...${NC}"
    docker exec -i ${PROJECT_NAME}-db psql -U supabase_admin -h localhost -d postgres < docker/init-db.sql 2>/dev/null || true
    echo -e "${GREEN}✓ Roles verificados${NC}"
  fi

  # Aplicar grants
  echo ""
  echo -e "${YELLOW}Configurando grants dos roles...${NC}"
  docker exec -i ${PROJECT_NAME}-db psql -U supabase_admin -h localhost -d postgres <<'GRANTS_SQL'
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
GRANTS_SQL
  echo -e "${GREEN}✓ Grants aplicados${NC}"

  # ── Aplicar migrations do projeto ──────────────────────────
  if [ -d "supabase/migrations" ] && [ "$(ls -A supabase/migrations 2>/dev/null)" ]; then
    echo ""
    echo -e "${YELLOW}Aplicando migrations do banco...${NC}"
    MIGRATION_COUNT=0
    MIGRATION_ERRORS=0
    for migration_file in supabase/migrations/*.sql; do
      if [ -f "$migration_file" ]; then
        MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
        migration_name=$(basename "$migration_file")
        if docker exec -i ${PROJECT_NAME}-db psql -U supabase_admin -h localhost -d postgres < "$migration_file" > /dev/null 2>&1; then
          echo -e "  ${GREEN}✓${NC} $migration_name"
        else
          MIGRATION_ERRORS=$((MIGRATION_ERRORS + 1))
          echo -e "  ${YELLOW}⚠${NC} $migration_name (pode já estar aplicada)"
        fi
      fi
    done
    echo -e "${GREEN}✓ ${MIGRATION_COUNT} migrations processadas (${MIGRATION_ERRORS} avisos)${NC}"
  else
    echo -e "${YELLOW}⚠ Nenhuma migration encontrada em supabase/migrations/${NC}"
  fi

  # ── Criar publication para realtime ────────────────────────
  echo ""
  echo -e "${YELLOW}Configurando realtime...${NC}"
  docker exec -i ${PROJECT_NAME}-db psql -U supabase_admin -h localhost -d postgres <<'REALTIME_SQL' 2>/dev/null || true
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.counters;
REALTIME_SQL
  echo -e "${GREEN}✓ Realtime configurado${NC}"

else
  echo ""
  echo -e "${YELLOW}Docker pulado (--skip-docker)${NC}"
fi

# ============================================================
# Instalar dependências npm
# ============================================================
if [ "$SKIP_NPM" = false ]; then
  echo ""
  echo -e "${YELLOW}Instalando dependências npm...${NC}"
  npm install
  echo -e "${GREEN}✓ Dependências npm instaladas${NC}"
fi

# ============================================================
# Criar scripts de conveniência
# ============================================================
echo ""
echo -e "${YELLOW}Criando scripts de conveniência...${NC}"

# start.sh
cat > start.sh << 'STARTEOF'
#!/bin/bash
set -e
cd "$(dirname "$0")"

# Detectar IP
SERVER_IP=$(curl -s --max-time 3 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

source .env.local 2>/dev/null || true

echo ""
echo -e "\033[0;36m╔══════════════════════════════════════════════════╗\033[0m"
echo -e "\033[0;36m║   🏥 Sistema de Senhas — Iniciando                ║\033[0m"
echo -e "\033[0;36m╠══════════════════════════════════════════════════╣\033[0m"
echo -e "\033[0;36m║\033[0m IP:       \033[0;32m$SERVER_IP\033[0m"
echo -e "\033[0;36m║\033[0m API:      \033[0;32m$API_EXTERNAL_URL\033[0m"
echo -e "\033[0;36m║\033[0m Frontend: \033[0;32m$SITE_URL\033[0m"
echo -e "\033[0;36m╚══════════════════════════════════════════════════╝\033[0m"
echo ""

echo "[1/2] Iniciando backend..."
docker compose up -d

echo "[2/2] Iniciando frontend..."
npx vite --host 0.0.0.0 --port ${VITE_PORT:-3001} &
VITE_PID=$!

cleanup() {
  echo "Parando serviços..."
  kill $VITE_PID 2>/dev/null || true
  docker compose stop
  echo "Parado."
}
trap cleanup EXIT INT TERM

echo ""
echo "Sistema rodando. Pressione Ctrl+C para parar."
wait
STARTEOF
chmod +x start.sh

# stop.sh
cat > stop.sh << 'STOPEOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "Parando serviços..."
pkill -f "vite.*--host" 2>/dev/null || true
docker compose stop
echo "Todos os serviços parados."
STOPEOF
chmod +x stop.sh

# reset.sh
cat > reset.sh << 'RESETEOF'
#!/bin/bash
set -e
cd "$(dirname "$0")"
source .env.local 2>/dev/null || true

PROJECT=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')

echo "⚠️  Isso vai APAGAR todos os dados e recriar o banco."
read -rp "Tem certeza? [s/N] " confirm
[[ "${confirm,,}" =~ ^(s|sim|y|yes)$ ]] || { echo "Cancelado."; exit 0; }

echo "Parando containers..."
docker compose down

echo "Removendo volume de dados..."
docker volume rm ${PROJECT}-db-data 2>/dev/null || true

echo "Recriando..."
docker compose up -d

echo "Aguardando banco..."
sleep 10

echo "Reaplicando roles e migrations..."
bash setup-local.sh --skip-npm --skip-docker=false -y 2>/dev/null || {
  docker exec -i ${PROJECT}-db psql -U supabase_admin -h localhost -d postgres < docker/init-db.sql
  for f in supabase/migrations/*.sql; do
    docker exec -i ${PROJECT}-db psql -U supabase_admin -h localhost -d postgres < "$f" 2>/dev/null || true
  done
}

echo "✅ Banco resetado com sucesso!"
RESETEOF
chmod +x reset.sh

echo -e "${GREEN}✓ Scripts start.sh, stop.sh, reset.sh criados${NC}"

# ============================================================
# Build de produção (opcional)
# ============================================================
if [ "$PRODUCTION" = true ]; then
  echo ""
  echo -e "${YELLOW}Compilando para produção...${NC}"
  npm run build
  echo -e "${GREEN}✓ Build de produção concluído em dist/${NC}"
  echo -e "${CYAN}Sirva com: npx serve dist -l ${APP_PORT}${NC}"
fi

# ============================================================
# Resultado final
# ============================================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ Instalação concluída com sucesso!            ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC} ${CYAN}Iniciar:${NC}          ./start.sh"
echo -e "${GREEN}║${NC} ${CYAN}Parar:${NC}            ./stop.sh"
echo -e "${GREEN}║${NC} ${CYAN}Resetar banco:${NC}    ./reset.sh"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC} ${CYAN}URLs:${NC}"
echo -e "${GREEN}║${NC}   Frontend:    ${GREEN}http://$HOST_IP:$APP_PORT${NC}"
echo -e "${GREEN}║${NC}   API:         ${GREEN}http://$HOST_IP:$API_PORT${NC}"
echo -e "${GREEN}║${NC}   DB:          ${GREEN}postgresql://postgres:***@$HOST_IP:$DB_PORT/postgres${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC} ${CYAN}Criar admin:${NC}    Acesse http://$HOST_IP:$APP_PORT/setup-admin"
echo -e "${GREEN}║${NC} ${CYAN}Login:${NC}          http://$HOST_IP:$APP_PORT/login"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC} ${CYAN}Containers Docker:${NC}"
echo -e "${GREEN}║${NC}   ${PROJECT_NAME}-db         PostgreSQL"
echo -e "${GREEN}║${NC}   ${PROJECT_NAME}-auth       Autenticação"
echo -e "${GREEN}║${NC}   ${PROJECT_NAME}-rest       API REST"
echo -e "${GREEN}║${NC}   ${PROJECT_NAME}-kong       API Gateway"
echo -e "${GREEN}║${NC}   ${PROJECT_NAME}-functions  Edge Functions"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
