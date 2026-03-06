#!/bin/bash

# ========================================
# TenPennyNovels - Link .env files
# ========================================
# Creates symlinks .env → .env.production for all services
# This allows dotenv to load production config automatically

set -e

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Creating .env symlinks..."
echo ""

# Backend Services
cd "$PROJECT_ROOT/services/unified-backend"
ln -sf .env.production .env
echo -e "${GREEN}✅ unified-backend/.env → .env.production${NC}"

# NOTE: botai-backend is NOT on VPS (runs via ngrok on local machine)

cd "$PROJECT_ROOT/services/embeddings-worker"
ln -sf .env.production .env
echo -e "${GREEN}✅ embeddings-worker/.env → .env.production${NC}"

# Frontend Apps
cd "$PROJECT_ROOT/apps/landing"
ln -sf .env.production .env
echo -e "${GREEN}✅ landing/.env → .env.production${NC}"

cd "$PROJECT_ROOT/apps/game"
ln -sf .env.production .env
echo -e "${GREEN}✅ game/.env → .env.production${NC}"

cd "$PROJECT_ROOT/apps/documents"
ln -sf .env.production .env
echo -e "${GREEN}✅ documents/.env → .env.production${NC}"

cd "$PROJECT_ROOT/apps/management"
ln -sf .env.production .env
echo -e "${GREEN}✅ management/.env → .env.production${NC}"

echo ""
echo -e "${GREEN}✅ All symlinks created!${NC}"
echo ""
echo "Services and apps will now load .env.production via dotenv"
