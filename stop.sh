#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$PROJECT_DIR/.frontend.pid"
PROXY_PID_FILE="$PROJECT_DIR/.proxy.pid"

cd "$PROJECT_DIR"

echo -e "${YELLOW}Parando sistema...${NC}"

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
  echo -e "${YELLOW}Nenhum PID do frontend encontrado${NC}"
fi

if [ -f "$PROXY_PID_FILE" ]; then
  PROXY_PID=$(cat "$PROXY_PID_FILE")
  if kill -0 "$PROXY_PID" 2>/dev/null; then
    kill "$PROXY_PID" 2>/dev/null
    sleep 1
    kill -9 "$PROXY_PID" 2>/dev/null || true
    echo -e "${GREEN}✓ Proxy gateway (PID $PROXY_PID) parado${NC}"
  else
    echo -e "${YELLOW}Proxy gateway já estava parado${NC}"
  fi
  rm -f "$PROXY_PID_FILE"
fi

if [ -f "docker-compose.yml" ]; then
  echo -e "${YELLOW}Parando containers Docker...${NC}"
  docker compose down 2>/dev/null
  echo -e "${GREEN}✓ Docker parado${NC}"
fi

echo -e "${GREEN}✅ Sistema parado${NC}"
