# Instalação no Windows

## Pré-requisitos

1. **Node.js 18+** — [nodejs.org](https://nodejs.org/) (LTS recomendado)
2. **Git** — [git-scm.com](https://git-scm.com/)

## Passo a Passo

### 1. Clone o projeto

```cmd
git clone <seu-repositorio>
cd <nome-do-projeto>
```

### 2. Configure o backend

Edite o arquivo `.env` na raiz do projeto com as credenciais do seu Supabase:

```env
VITE_SUPABASE_URL=https://seuprojetoid.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_SUPABASE_PROJECT_ID=seuprojetoid
```

### 3. Instale e compile

Dê **duplo clique** em `install.bat` ou execute no terminal:

```cmd
install.bat
```

Isso irá:
- Instalar dependências (`npm install`)
- Compilar o frontend (`npm run build`)
- Instalar o PM2 globalmente

### 4. Inicie o sistema

Dê **duplo clique** em `start.bat` ou execute:

```cmd
start.bat
```

O sistema ficará disponível na sua rede local:

| Página | URL |
|--------|-----|
| Início | `http://SEU-IP:3001` |
| Totem | `http://SEU-IP:3001/totem` |
| Painel | `http://SEU-IP:3001/panel` |
| Admin | `http://SEU-IP:3001/admin` |

### 5. Gerenciamento

| Ação | Comando |
|------|---------|
| Parar | `stop.bat` ou `pm2 stop senhas-frontend` |
| Reiniciar | `pm2 restart senhas-frontend` |
| Ver logs | `pm2 logs senhas-frontend` |
| Status | `pm2 status` |
| Atualizar | `update.bat` |

### 6. Iniciar com o Windows (opcional)

Para que o sistema inicie automaticamente ao ligar o PC:

```cmd
pm2 start ecosystem.config.cjs
pm2 save
pm2-startup install
```

Ou crie um atalho de `start.bat` na pasta `shell:startup`.

---

## Scripts Disponíveis

| Arquivo | Descrição |
|---------|-----------|
| `install.bat` | Instalação completa (deps + build + PM2) |
| `start.bat` | Inicia o sistema e mostra IP |
| `stop.bat` | Para o sistema |
| `update.bat` | Atualiza via git + rebuild + restart |

## Solução de Problemas

### Porta 3001 em uso
```cmd
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### PM2 não encontrado
Execute o terminal como **Administrador** e rode:
```cmd
npm install -g pm2
```

### Build falha
Verifique se o Node.js é versão 18+:
```cmd
node -v
```
