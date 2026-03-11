#!/bin/bash

# ============================================================
# Stop - Para frontend e backend
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PID_FILE=".frontend.pid"

echo -e "${YELLOW}Parando sistema...${NC}"

# Parar frontend
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null
    sleep 1
    kill -9 "$PID" 2>/dev/null || true
    echo -e "${GREEN}✓ Frontend (PID $PID) parado${NC}"
  else
    echo -e "${YELLOW}Frontend já estava parado${NC}"
  fi
  rm -f "$PID_FILE"
else
  echo -e "${YELLOW}Nenhum PID encontrado${NC}"
fi

# Parar Docker
if [ -f "docker-compose.yml" ]; then
  echo -e "${YELLOW}Parando containers Docker...${NC}"
  docker compose down 2>/dev/null
  echo -e "${GREEN}✓ Docker parado${NC}"
fi

echo -e "${GREEN}✅ Sistema parado${NC}"
