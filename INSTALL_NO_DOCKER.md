# 🖥️ Instalação do Backend SEM Docker (Supabase Local Nativo)

Guia para rodar o backend Supabase localmente **sem Docker**, usando PostgreSQL nativo e Deno para Edge Functions.

---

## Pré-requisitos

- **Linux** (Ubuntu/Debian 20.04+)
- **Node.js 18+**
- **Git**

---

## Passo 1 — Instalar PostgreSQL 15+

```bash
# Adicionar repositório oficial do PostgreSQL
sudo apt install -y wget gnupg2 lsb-release
wget -qO - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt update
sudo apt install -y postgresql-15 postgresql-contrib-15

# Iniciar e habilitar no boot
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verificar
psql --version
```

---

## Passo 2 — Configurar o banco de dados

```bash
# Acessar como superusuário do PostgreSQL
sudo -u postgres psql
```

Dentro do `psql`, execute:

```sql
-- Criar usuário do sistema
CREATE USER supabase_admin WITH PASSWORD 'sua_senha_segura' SUPERUSER;

-- Criar banco de dados
CREATE DATABASE fila_db OWNER supabase_admin;

-- Habilitar extensões necessárias
\c fila_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sair
\q
```

---

## Passo 3 — Aplicar as migrações do banco

```bash
# Na pasta do projeto, aplique todas as migrações manualmente
cd /caminho/do/projeto

# Conectar ao banco e executar cada arquivo de migração
for f in supabase/migrations/*.sql; do
  echo "Aplicando: $f"
  psql "postgresql://supabase_admin:sua_senha_segura@127.0.0.1:5432/fila_db" -f "$f"
done
```

> ⚠️ Substitua `sua_senha_segura` pela senha que você definiu no Passo 2.

---

## Passo 4 — Instalar GoTrue (Autenticação)

O GoTrue é o serviço de autenticação do Supabase.

```bash
# Baixar o binário do GoTrue
wget https://github.com/supabase/auth/releases/latest/download/auth-v2.169.0-x86_64-linux.tar.gz
tar -xzf auth-*.tar.gz
sudo mv auth /usr/local/bin/gotrue

# Verificar
gotrue --version
```

Criar arquivo de configuração `/etc/gotrue.env`:

```bash
sudo tee /etc/gotrue.env << 'EOF'
GOTRUE_DB_DRIVER=postgres
DATABASE_URL=postgresql://supabase_admin:sua_senha_segura@127.0.0.1:5432/fila_db?sslmode=disable
GOTRUE_SITE_URL=http://localhost:3001
GOTRUE_JWT_SECRET=super-secret-jwt-token-com-pelo-menos-32-caracteres!!
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=true
API_EXTERNAL_URL=http://127.0.0.1:9999
GOTRUE_API_HOST=0.0.0.0
PORT=9999
EOF
```

Iniciar o GoTrue:

```bash
# Testar manualmente
gotrue serve --config /etc/gotrue.env

# Ou criar serviço systemd (veja Passo 8)
```

---

## Passo 5 — Instalar PostgREST (API REST)

O PostgREST expõe o banco como uma API REST automaticamente.

```bash
# Baixar PostgREST
wget https://github.com/PostgREST/postgrest/releases/latest/download/postgrest-v12.2.3-linux-static-x86-64.tar.xz
tar -xf postgrest-*.tar.xz
sudo mv postgrest /usr/local/bin/postgrest

# Verificar
postgrest --version
```

Criar arquivo de configuração `/etc/postgrest.conf`:

```bash
sudo tee /etc/postgrest.conf << 'EOF'
db-uri = "postgresql://supabase_admin:sua_senha_segura@127.0.0.1:5432/fila_db"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "super-secret-jwt-token-com-pelo-menos-32-caracteres!!"
server-host = "0.0.0.0"
server-port = 3000
EOF
```

Criar os roles necessários no banco:

```bash
sudo -u postgres psql fila_db << 'SQL'
-- Criar roles usados pelo PostgREST
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN SUPERUSER;

-- Conceder permissões
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
SQL
```

Iniciar o PostgREST:

```bash
postgrest /etc/postgrest.conf
```

---

## Passo 6 — Instalar Kong ou Envoy (API Gateway) — Opcional mas Recomendado

O API Gateway unifica PostgREST + GoTrue em uma única URL (como o Supabase faz na porta 54321).

**Opção simples com Nginx:**

```bash
sudo apt install -y nginx

sudo tee /etc/nginx/sites-available/supabase-gateway << 'EOF'
server {
    listen 54321;
    server_name _;

    # API REST (PostgREST)
    location /rest/v1/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # CORS
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "authorization, x-client-info, apikey, content-type";

        if ($request_method = OPTIONS) {
            return 204;
        }
    }

    # Auth (GoTrue)
    location /auth/v1/ {
        proxy_pass http://127.0.0.1:9999/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "authorization, x-client-info, apikey, content-type";

        if ($request_method = OPTIONS) {
            return 204;
        }
    }

    # Edge Functions (Deno)
    location /functions/v1/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "authorization, x-client-info, apikey, content-type";

        if ($request_method = OPTIONS) {
            return 204;
        }
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/supabase-gateway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Passo 7 — Instalar Deno (Edge Functions)

```bash
# Instalar Deno
curl -fsSL https://deno.land/install.sh | sh

# Adicionar ao PATH
echo 'export DENO_DIR="$HOME/.deno"' >> ~/.bashrc
echo 'export PATH="$DENO_DIR/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verificar
deno --version
```

Servir as Edge Functions:

```bash
cd /caminho/do/projeto

# Criar script para servir cada função
cat > serve-functions.sh << 'SCRIPT'
#!/bin/bash
export SUPABASE_URL="http://127.0.0.1:54321"
export SUPABASE_SERVICE_ROLE_KEY="seu-service-role-jwt-aqui"
export SUPABASE_ANON_KEY="seu-anon-key-jwt-aqui"

# Servir todas as funções na porta 8000
deno serve --allow-all --port 8000 supabase/functions/*/index.ts
SCRIPT

chmod +x serve-functions.sh
```

> **Nota:** Para gerar as chaves JWT (anon e service_role), use:
> ```bash
> # Instalar ferramenta JWT
> npm install -g jwt-cli
>
> # Gerar anon key
> jwt sign '{"role":"anon","iss":"supabase","iat":1700000000,"exp":2000000000}' "super-secret-jwt-token-com-pelo-menos-32-caracteres!!"
>
> # Gerar service_role key
> jwt sign '{"role":"service_role","iss":"supabase","iat":1700000000,"exp":2000000000}' "super-secret-jwt-token-com-pelo-menos-32-caracteres!!"
> ```

---

## Passo 8 — Criar serviços systemd (auto-start)

```bash
# PostgreSQL já tem serviço próprio

# Serviço GoTrue
sudo tee /etc/systemd/system/gotrue.service << 'EOF'
[Unit]
Description=GoTrue Auth Server
After=postgresql.service
Requires=postgresql.service

[Service]
Type=simple
EnvironmentFile=/etc/gotrue.env
ExecStart=/usr/local/bin/gotrue serve
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Serviço PostgREST
sudo tee /etc/systemd/system/postgrest.service << 'EOF'
[Unit]
Description=PostgREST API
After=postgresql.service
Requires=postgresql.service

[Service]
Type=simple
ExecStart=/usr/local/bin/postgrest /etc/postgrest.conf
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Ativar tudo
sudo systemctl daemon-reload
sudo systemctl enable gotrue postgrest nginx
sudo systemctl start gotrue postgrest
```

---

## Passo 9 — Configurar o Frontend

Crie o arquivo `.env` na raiz do projeto:

```bash
cat > .env << 'EOF'
VITE_SUPABASE_URL=http://SEU_IP_LOCAL:54321
VITE_SUPABASE_PUBLISHABLE_KEY=COLE_A_ANON_KEY_GERADA_NO_PASSO_7
VITE_SUPABASE_PROJECT_ID=local
EOF
```

---

## Passo 10 — Criar o primeiro administrador

```bash
# Conectar ao banco
psql "postgresql://supabase_admin:sua_senha_segura@127.0.0.1:5432/fila_db"
```

```sql
-- Criar usuário via GoTrue API
-- Ou acesse /setup-admin no navegador após iniciar o frontend
```

Ou use curl para criar via API:

```bash
curl -X POST http://127.0.0.1:54321/auth/v1/signup \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_ANON_KEY" \
  -d '{"email":"admin@local.com","password":"admin123"}'
```

Depois, adicione o role admin no banco:

```bash
psql "postgresql://supabase_admin:sua_senha_segura@127.0.0.1:5432/fila_db" \
  -c "INSERT INTO user_roles (user_id, role) VALUES ('UUID_DO_USUARIO', 'admin');"
```

---

## Passo 11 — Iniciar o Frontend

```bash
cd /caminho/do/projeto
npm install
npm run build
bash start.sh --port 3001 --production
```

---

## Resumo dos serviços

| Serviço      | Porta  | Descrição                    |
|-------------|--------|------------------------------|
| PostgreSQL  | 5432   | Banco de dados               |
| GoTrue      | 9999   | Autenticação (Auth)          |
| PostgREST   | 3000   | API REST automática          |
| Nginx       | 54321  | Gateway (unifica tudo)       |
| Deno        | 8000   | Edge Functions               |
| Frontend    | 3001   | Aplicação React              |

---

## Comandos úteis

```bash
# Ver status dos serviços
sudo systemctl status postgresql gotrue postgrest nginx

# Reiniciar tudo
sudo systemctl restart postgresql gotrue postgrest nginx

# Ver logs
journalctl -u gotrue -f
journalctl -u postgrest -f

# Testar API
curl http://127.0.0.1:54321/rest/v1/service_types -H "apikey: SUA_ANON_KEY"

# Testar Auth
curl http://127.0.0.1:54321/auth/v1/health
```

---

## Solução de problemas

### PostgREST não conecta
```bash
# Verificar se PostgreSQL aceita conexões TCP
sudo nano /etc/postgresql/15/main/postgresql.conf
# Alterar: listen_addresses = '*'

sudo nano /etc/postgresql/15/main/pg_hba.conf
# Adicionar: host all all 127.0.0.1/32 md5

sudo systemctl restart postgresql
```

### CORS bloqueando requisições
```bash
# Verificar configuração do Nginx
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### GoTrue não inicia
```bash
# Verificar se o banco auth schema existe
psql "postgresql://supabase_admin:sua_senha_segura@127.0.0.1:5432/fila_db" \
  -c "CREATE SCHEMA IF NOT EXISTS auth;"

# Ver logs detalhados
journalctl -u gotrue -f --no-pager
```

### Edge Functions não respondem
```bash
# Testar Deno diretamente
cd /caminho/do/projeto
deno run --allow-all supabase/functions/setup-admin/index.ts
```

---

## ✅ Pronto!

O sistema agora roda **sem Docker**, usando serviços nativos do Linux. Todos os componentes são gerenciados via systemd.
