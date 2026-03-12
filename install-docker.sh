#!/bin/bash
# ============================================================
# install-docker.sh — Instala backend completo via Docker
# Sobe PostgreSQL + GoTrue + PostgREST + Kong + Edge Functions
# e configura o .env do frontend automaticamente.
#
# Uso: bash install-docker.sh [opções]
#   --port <porta>       Porta do API Gateway (default: 54321)
#   --app-port <porta>   Porta do Frontend (default: 3001)
#   --db-port <porta>    Porta do PostgreSQL (default: 54320)
#   --host <ip>          IP do servidor (default: auto-detectado)
#   --password <senha>   Senha do PostgreSQL (default: gerada)
#   --jwt-secret <chave> JWT secret (default: gerada)
#   -y, --yes            Aceitar tudo automaticamente
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Defaults
API_PORT=54321
APP_PORT=3001
DB_PORT=54320
HOST_IP=""
POSTGRES_PASSWORD=""
JWT_SECRET=""
AUTO_YES=false
PROJECT_NAME=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')

while [[ $# -gt 0 ]]; do
  case $1 in
    --port) API_PORT="$2"; shift 2 ;;
    --app-port) APP_PORT="$2"; shift 2 ;;
    --db-port) DB_PORT="$2"; shift 2 ;;
    --host) HOST_IP="$2"; shift 2 ;;
    --password) POSTGRES_PASSWORD="$2"; shift 2 ;;
    --jwt-secret) JWT_SECRET="$2"; shift 2 ;;
    -y|--yes) AUTO_YES=true; shift ;;
    -h|--help) sed -n '3,14p' "$0" | sed 's/^# //' | sed 's/^#//'; exit 0 ;;
    *) shift ;;
  esac
done

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║  🐳 Backend Docker — Sistema de Senhas           ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ============================================================
# 1. Verificar dependências
# ============================================================
echo -e "${YELLOW}[1/7] Verificando dependências...${NC}"

for cmd in docker node npm; do
  if ! command -v $cmd &>/dev/null; then
    echo -e "${RED}✗ $cmd não encontrado.${NC}"
    [[ "$cmd" == "docker" ]] && echo "  Instale: curl -fsSL https://get.docker.com | sh"
    [[ "$cmd" == "node" ]] && echo "  Instale: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
    exit 1
  fi
  echo -e "  ${GREEN}✓ $cmd${NC}"
done

if ! docker info &>/dev/null; then
  echo -e "${RED}✗ Docker não está rodando. Execute: sudo systemctl start docker${NC}"
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
[[ "$NODE_VER" -ge 18 ]] || { echo -e "${RED}✗ Node.js 18+ necessário${NC}"; exit 1; }

echo -e "${GREEN}✓ Todas as dependências OK${NC}"

# ============================================================
# 2. Detectar IP
# ============================================================
echo -e "${YELLOW}[2/7] Detectando IP da rede...${NC}"

if [ -z "$HOST_IP" ]; then
  HOST_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[\d.]+' | head -1)
  [ -z "$HOST_IP" ] && HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  [ -z "$HOST_IP" ] && HOST_IP="127.0.0.1"
fi
echo -e "${GREEN}✓ IP: ${HOST_IP}${NC}"

# ============================================================
# 3. Gerar credenciais
# ============================================================
echo -e "${YELLOW}[3/7] Gerando credenciais...${NC}"

[ -z "$POSTGRES_PASSWORD" ] && POSTGRES_PASSWORD=$(openssl rand -hex 16 2>/dev/null || echo "pg_$(date +%s)")
[ -z "$JWT_SECRET" ] && JWT_SECRET=$(openssl rand -base64 48 2>/dev/null || echo "jwt-secret-local-$(date +%s)-at-least-32-chars")

ANON_KEY=$(node -e "
const crypto = require('crypto');
const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const p = Buffer.from(JSON.stringify({iss:'supabase',ref:'local',role:'anon',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+315360000})).toString('base64url');
console.log(h+'.'+p+'.'+crypto.createHmac('sha256','${JWT_SECRET}').update(h+'.'+p).digest('base64url'));
")

SERVICE_KEY=$(node -e "
const crypto = require('crypto');
const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const p = Buffer.from(JSON.stringify({iss:'supabase',ref:'local',role:'service_role',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+315360000})).toString('base64url');
console.log(h+'.'+p+'.'+crypto.createHmac('sha256','${JWT_SECRET}').update(h+'.'+p).digest('base64url'));
")

echo -e "${GREEN}✓ JWT keys geradas${NC}"

# Confirmar
echo ""
echo -e "${CYAN}Configuração:${NC}"
echo -e "  API Gateway: http://${HOST_IP}:${API_PORT}"
echo -e "  Frontend:    http://${HOST_IP}:${APP_PORT}"
echo -e "  PostgreSQL:  ${HOST_IP}:${DB_PORT}"
echo ""

if [[ "$AUTO_YES" != true ]]; then
  read -rp "Continuar? [S/n] " confirm
  [[ "${confirm,,}" =~ ^(n|não|nao|no)$ ]] && { echo "Cancelado."; exit 0; }
fi

# ============================================================
# 4. Criar arquivos Docker
# ============================================================
echo -e "${YELLOW}[4/7] Criando configuração Docker...${NC}"

mkdir -p docker

# -- init-db.sql --
cat > docker/init-db.sql << SQLEOF
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
END \$\$;
ALTER ROLE authenticator PASSWORD '${POSTGRES_PASSWORD}';

DO \$\$ BEGIN
  EXECUTE 'GRANT anon TO authenticator';
  EXECUTE 'GRANT authenticated TO authenticator';
  EXECUTE 'GRANT service_role TO authenticator';
EXCEPTION WHEN OTHERS THEN NULL;
END \$\$;

DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOINHERIT CREATEROLE LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
END \$\$;
ALTER ROLE supabase_auth_admin PASSWORD '${POSTGRES_PASSWORD}';

GRANT ALL ON SCHEMA public TO supabase_auth_admin;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;
SQLEOF

# -- kong.yml --
cat > docker/kong.yml << KONGEOF
_format_version: "2.1"
_transform: true

services:
  - name: rest-v1
    url: http://rest:3000/
    routes:
      - name: rest-v1
        strip_path: true
        paths: [/rest/v1/]
    plugins:
      - name: cors
        config:
          origins: ["*"]
          methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
          headers: [Accept, Content-Type, Authorization, apikey, x-client-info]
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
        paths: [/auth/v1/]
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
        paths: [/functions/v1/]
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
      - key: ${SERVICE_KEY}
KONGEOF

# -- Edge functions main entry --
mkdir -p supabase/functions/main
if [ ! -f "supabase/functions/main/index.ts" ]; then
cat > supabase/functions/main/index.ts << 'FNEOF'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;
  if (path === "/" || path === "/health") {
    return new Response(JSON.stringify({ status: "ok" }), { headers: { "Content-Type": "application/json" } });
  }
  const fn = path.split("/").filter(Boolean)[0];
  if (fn) {
    try {
      const mod = await import(`../${fn}/index.ts`);
      if (typeof mod.default === "function") return mod.default(req);
    } catch {}
  }
  return new Response(JSON.stringify({ error: "Function not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
});
FNEOF
fi

echo -e "${GREEN}✓ Arquivos Docker criados${NC}"

# ============================================================
# 5. Criar docker-compose.yml
# ============================================================
echo -e "${YELLOW}[5/7] Criando docker-compose.yml...${NC}"

cat > docker-compose.yml << COMPEOF
# Backend Docker — Gerado por install-docker.sh em $(date)
services:
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

  auth:
    image: supabase/gotrue:v2.158.1
    container_name: ${PROJECT_NAME}-auth
    restart: unless-stopped
    depends_on:
      db: { condition: service_healthy }
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: http://${HOST_IP}:${API_PORT}
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@db:5432/postgres
      GOTRUE_SITE_URL: http://${HOST_IP}:${APP_PORT}
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_EXP: 3600
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_MAILER_AUTOCONFIRM: "true"
      GOTRUE_SMTP_ADMIN_EMAIL: admin@local.com
      GOTRUE_LOG_LEVEL: warn

  rest:
    image: postgrest/postgrest:v12.2.3
    container_name: ${PROJECT_NAME}-rest
    restart: unless-stopped
    depends_on:
      db: { condition: service_healthy }
    environment:
      PGRST_DB_URI: postgres://authenticator:${POSTGRES_PASSWORD}@db:5432/postgres
      PGRST_DB_SCHEMAS: public,storage
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET}
      PGRST_DB_USE_LEGACY_GUCS: "false"
      PGRST_APP_SETTINGS_JWT_SECRET: ${JWT_SECRET}
      PGRST_APP_SETTINGS_JWT_EXP: 3600

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
    depends_on: [auth, rest]

  functions:
    image: supabase/edge-runtime:v1.65.3
    container_name: ${PROJECT_NAME}-functions
    restart: unless-stopped
    depends_on:
      db: { condition: service_healthy }
    environment:
      JWT_SECRET: ${JWT_SECRET}
      SUPABASE_URL: http://kong:8000
      SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_KEY}
      SUPABASE_DB_URL: postgres://postgres:${POSTGRES_PASSWORD}@db:5432/postgres
      VERIFY_JWT: "false"
    volumes:
      - ./supabase/functions:/home/deno/functions:ro
    command: ["start", "--main-service", "/home/deno/functions/main"]

volumes:
  ${PROJECT_NAME}-db-data:
    driver: local
COMPEOF

echo -e "${GREEN}✓ docker-compose.yml criado${NC}"

# ============================================================
# 6. Subir containers e aplicar schema
# ============================================================
echo -e "${YELLOW}[6/7] Subindo containers Docker...${NC}"

docker compose down 2>/dev/null || true
docker compose up -d

echo -e "${CYAN}  Aguardando banco ficar pronto...${NC}"
RETRIES=0
until docker exec ${PROJECT_NAME}-db pg_isready -U supabase_admin -d postgres -h localhost &>/dev/null; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge 30 ]; then
    echo -e "${RED}✗ Banco não ficou pronto. Verifique: docker compose logs db${NC}"
    exit 1
  fi
  sleep 2
done
echo -e "${GREEN}✓ Banco pronto${NC}"

# Aplicar roles
echo -e "${CYAN}  Aplicando roles...${NC}"
docker exec -i ${PROJECT_NAME}-db psql -U supabase_admin -h localhost -d postgres < docker/init-db.sql 2>/dev/null || true

docker exec -i ${PROJECT_NAME}-db psql -U supabase_admin -h localhost -d postgres <<'GRANTS' 2>/dev/null || true
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
GRANTS
echo -e "${GREEN}✓ Roles aplicados${NC}"

# Aplicar migrations
if [ -d "supabase/migrations" ] && [ "$(ls -A supabase/migrations 2>/dev/null)" ]; then
  echo -e "${CYAN}  Aplicando migrations...${NC}"
  for f in supabase/migrations/*.sql; do
    [ -f "$f" ] || continue
    fname=$(basename "$f")
    if docker exec -i ${PROJECT_NAME}-db psql -U supabase_admin -h localhost -d postgres < "$f" &>/dev/null; then
      echo -e "    ${GREEN}✓${NC} $fname"
    else
      echo -e "    ${YELLOW}⚠${NC} $fname (pode já existir)"
    fi
  done
  echo -e "${GREEN}✓ Migrations aplicadas${NC}"
fi

# Realtime
docker exec -i ${PROJECT_NAME}-db psql -U supabase_admin -h localhost -d postgres <<'REALTIME' 2>/dev/null || true
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.counters;
REALTIME

echo -e "${GREEN}✓ Realtime configurado${NC}"

# ============================================================
# 7. Configurar .env do frontend
# ============================================================
echo -e "${YELLOW}[7/7] Configurando frontend...${NC}"

# Backup
[ -f ".env" ] && cp .env ".env.backup.$(date +%Y%m%d%H%M%S)"

cat > .env << ENVEOF
# Gerado por install-docker.sh em $(date)
VITE_SUPABASE_URL=http://${HOST_IP}:${API_PORT}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=local
ENVEOF

# Salvar credenciais
cat > .env.local << LOCALEOF
# Credenciais do backend — NÃO compartilhe
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_KEY}
HOST_IP=${HOST_IP}
API_PORT=${API_PORT}
APP_PORT=${APP_PORT}
DB_PORT=${DB_PORT}
LOCALEOF

echo -e "${GREEN}✓ .env configurado${NC}"

# Instalar deps + build
echo -e "${CYAN}  Instalando dependências npm...${NC}"
npm install --legacy-peer-deps 2>&1 | tail -3
echo -e "${CYAN}  Compilando frontend...${NC}"
npx vite build 2>&1 | tail -3
echo -e "${GREEN}✓ Frontend compilado${NC}"

# ============================================================
# Resultado
# ============================================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Backend Docker instalado com sucesso!            ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}Frontend:${NC}    http://${HOST_IP}:${APP_PORT}"
echo -e "${GREEN}║${NC}  ${CYAN}API Gateway:${NC} http://${HOST_IP}:${API_PORT}"
echo -e "${GREEN}║${NC}  ${CYAN}PostgreSQL:${NC}  ${HOST_IP}:${DB_PORT}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}Containers:${NC}"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | while read line; do
  echo -e "${GREEN}║${NC}    $line"
done
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}Iniciar frontend:${NC}"
echo -e "${GREEN}║${NC}    npx vite preview --host 0.0.0.0 --port ${APP_PORT}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}Ou modo dev:${NC}"
echo -e "${GREEN}║${NC}    npx vite --host 0.0.0.0 --port ${APP_PORT}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}Criar admin:${NC} Acesse http://${HOST_IP}:${APP_PORT}/login"
echo -e "${GREEN}║${NC}  ${CYAN}Parar tudo:${NC}  docker compose down"
echo -e "${GREEN}║${NC}  ${CYAN}Ver logs:${NC}    docker compose logs -f"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Para iniciar o frontend agora:${NC}"
echo -e "  ${CYAN}npx vite preview --host 0.0.0.0 --port ${APP_PORT}${NC}"
