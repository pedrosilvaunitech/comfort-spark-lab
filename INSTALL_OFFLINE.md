# 🔒 Instalação 100% Offline (Frontend + Backend Local)

Este guia ensina como rodar o sistema completo localmente, sem depender de nenhum servidor externo.

---

## Pré-requisitos

- **Linux** (Ubuntu/Debian recomendado)
- **Node.js 18+**
- **Docker** e **Docker Compose**
- **Git**

---

## Passo 1 — Instalar Node.js

```bash
# Instalar NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Instalar Node.js 18
nvm install 18
nvm use 18

# Verificar
node -v   # deve ser v18.x ou superior
npm -v
```

---

## Passo 2 — Instalar Docker

```bash
# Atualizar pacotes
sudo apt update

# Instalar dependências
sudo apt install -y ca-certificates curl gnupg lsb-release

# Adicionar chave GPG do Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Adicionar repositório Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Permitir usar Docker sem sudo
sudo usermod -aG docker $USER
newgrp docker

# Verificar
docker --version
docker compose version
```

---

## Passo 3 — Instalar Supabase CLI

```bash
# Via NPM (mais fácil)
npm install -g supabase

# Verificar
supabase --version
```

**Alternativa (download direto):**
```bash
curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh
```

---

## Passo 4 — Clonar o repositório

```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd <NOME_DA_PASTA>
npm install
```

---

## Passo 5 — Iniciar Supabase Local

```bash
# Iniciar todos os serviços Supabase localmente (primeira vez baixa imagens Docker ~2GB)
supabase start
```

Ao finalizar, ele mostra as URLs e chaves locais. Anote:

```
API URL:            http://127.0.0.1:54321
GraphQL URL:        http://127.0.0.1:54321/graphql/v1
DB URL:             postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL:         http://127.0.0.1:54323
Anon key:           eyJhbG... (chave local)
Service role key:   eyJhbG... (chave local)
```

---

## Passo 6 — Aplicar as migrações do banco

```bash
# Isso cria todas as tabelas, funções, triggers e políticas RLS
supabase db reset
```

Isso aplica automaticamente todos os arquivos em `supabase/migrations/`.

---

## Passo 7 — Configurar variáveis de ambiente

Crie o arquivo `.env` com as chaves **locais** (mostradas no passo 5):

```bash
cat > .env << 'EOF'
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<COLE_A_ANON_KEY_LOCAL_AQUI>
VITE_SUPABASE_PROJECT_ID=local
EOF
```

> ⚠️ Substitua `<COLE_A_ANON_KEY_LOCAL_AQUI>` pela anon key que apareceu no `supabase start`.

---

## Passo 8 — Deploy das Edge Functions locais

```bash
# Servir edge functions localmente
supabase functions serve
```

> Deixe este comando rodando em um terminal separado.

---

## Passo 9 — Criar o primeiro administrador

Como o backend é local, acesse o **Supabase Studio** para gerenciar dados:

1. Abra **http://127.0.0.1:54323** no navegador
2. Vá em **SQL Editor**
3. Execute o SQL abaixo para criar um usuário admin:

```sql
-- Criar usuário de teste (via dashboard do Studio: Authentication > Users > Add User)
-- Email: admin@local.com / Senha: admin123

-- Após criar o usuário no Studio, pegue o UUID dele e execute:
INSERT INTO public.user_roles (user_id, role)
VALUES ('<UUID_DO_USUARIO>', 'admin');
```

**Ou** acesse a página `/setup-admin` no sistema para criar o primeiro admin.

---

## Passo 10 — Rodar o frontend

```bash
npm run dev
```

Acesse: **http://localhost:8080**

---

## Resumo dos terminais necessários

| Terminal | Comando | Descrição |
|----------|---------|-----------|
| 1 | `supabase start` | Backend (banco, auth, API) |
| 2 | `supabase functions serve` | Edge Functions |
| 3 | `npm run dev` | Frontend React |

---

## Comandos úteis

```bash
# Parar Supabase local
supabase stop

# Ver status dos serviços
supabase status

# Resetar banco (reaplicar migrações)
supabase db reset

# Ver logs das edge functions
supabase functions logs <nome-da-funcao>

# Acessar banco diretamente
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

---

## Solução de problemas

### Docker não está rodando
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

### Porta em uso
```bash
# Verificar o que usa a porta 54321
sudo lsof -i :54321
# Ou matar o processo
sudo kill -9 <PID>
```

### Erro nas migrações
```bash
# Resetar completamente
supabase stop
supabase start
supabase db reset
```

### Edge functions não respondem
```bash
# Verificar se estão rodando
supabase functions serve --debug
```

---

## ✅ Pronto!

O sistema agora roda 100% offline. Todos os dados ficam no PostgreSQL local via Docker.
