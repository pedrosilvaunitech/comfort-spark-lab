# Executando com PM2

## Pré-requisitos

```bash
npm install -g pm2
```

## Iniciar

```bash
# Build primeiro
npm run build

# Iniciar com PM2
pm2 start ecosystem.config.cjs

# Verificar status
pm2 status

# Ver logs
pm2 logs senhas-frontend
```

## Gerenciamento

```bash
# Parar
pm2 stop senhas-frontend

# Reiniciar
pm2 restart senhas-frontend

# Iniciar automaticamente no boot
pm2 startup
pm2 save
```

## Atualizar

```bash
git pull
npm install
npm run build
pm2 restart senhas-frontend
```

O frontend ficará disponível em `http://<SEU-IP>:3001`
