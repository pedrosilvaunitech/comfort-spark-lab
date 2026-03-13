# Build do .EXE Desktop (Windows)

## Como funciona

O `.exe` empacota o **frontend compilado** (HTML/JS/CSS) dentro de um aplicativo Electron. 
Ele se comunica diretamente com o seu **backend Supabase na nuvem** — nenhum servidor local é necessário.

## Pré-requisitos

- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **Git** — [git-scm.com](https://git-scm.com/)

## Passo a Passo

### 1. Clone e configure

```cmd
git clone <seu-repositorio>
cd <nome-do-projeto>
```

### 2. Configure o backend no `.env`

```env
VITE_SUPABASE_URL=https://seuprojetoid.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
VITE_SUPABASE_PROJECT_ID=seuprojetoid
```

### 3. Gere o .EXE

Dê **duplo clique** em `build-exe.bat` ou execute:

```cmd
build-exe.bat
```

### 4. Resultado

O arquivo `.exe` portátil será gerado em:

```
electron-dist/SistemaDeSenhas-1.0.0.exe
```

Basta copiar esse arquivo para qualquer PC Windows e **executar diretamente** — não precisa instalar nada.

## Instalador (opcional)

Para gerar um instalador `.exe` com atalho no menu Iniciar:

```cmd
cd electron
npm run build-installer
```

## Arquitetura

```
┌─────────────────────────────┐
│   SistemaDeSenhas.exe       │
│  ┌───────────────────────┐  │
│  │  Electron (Chromium)  │  │
│  │  ┌─────────────────┐  │  │
│  │  │ Frontend (dist/) │  │  │
│  │  │ React + Vite     │  │  │
│  │  └────────┬────────┘  │  │
│  └───────────┼───────────┘  │
└──────────────┼──────────────┘
               │ HTTPS
    ┌──────────▼──────────┐
    │  Supabase Cloud     │
    │  (Auth + DB + API)  │
    └─────────────────────┘
```

O `.exe` contém apenas o frontend. Toda a lógica de dados e autenticação roda no Supabase Cloud.
