# 🌐 Instalação com Backend Online (Lovable Cloud)

Este guia ensina como rodar o frontend localmente conectado ao backend online.

---

## Pré-requisitos

- **Node.js 18+** instalado
- **Git** instalado

---

## Passo a Passo

### 1. Instalar Node.js (se não tiver)

```bash
# Instalar NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Instalar Node.js 18
nvm install 18
nvm use 18

# Verificar
node -v
npm -v
```

### 2. Clonar o repositório

```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd <NOME_DA_PASTA>
```

### 3. Instalar dependências

```bash
npm install
```

### 4. Criar arquivo `.env`

Crie o arquivo `.env` na raiz do projeto:

```bash
cat > .env << 'EOF'
VITE_SUPABASE_URL=https://pbjyudhxnhtxiblhkwgh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBianl1ZGh4bmh0eGlibGhrd2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTQ2NjAsImV4cCI6MjA4NzY3MDY2MH0.x1EjCqhJGfKwNu21GtN0jwm-nfwBJWzMHdD8ycWBXEM
VITE_SUPABASE_PROJECT_ID=pbjyudhxnhtxiblhkwgh
EOF
```

### 5. Rodar o servidor de desenvolvimento

```bash
npm run dev
```

Acesse: **http://localhost:8080**

### 6. Build para produção (opcional)

```bash
npm run build
npm run preview
```

---

## ✅ Pronto!

O frontend roda localmente e o banco de dados, autenticação e edge functions ficam no servidor online (Lovable Cloud). Não precisa instalar nada de backend.
