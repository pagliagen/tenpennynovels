#!/bin/bash

# ========================================
# TenPennyNovels - Setup Environment Files
# ========================================
# This script copies all .env templates to their correct destinations

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATES_DIR="$PROJECT_ROOT/deploy/primo-rilascio-manuale/env-templates"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}TenPennyNovels - Setup Environment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print colored status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

# Function to copy env file
copy_env() {
    local template=$1
    local destination=$2

    if [ -f "$TEMPLATES_DIR/$template" ]; then
        cp "$TEMPLATES_DIR/$template" "$destination"
        print_status $? "Copied $template → $destination"
    else
        echo -e "${RED}❌ Template not found: $template${NC}"
        exit 1
    fi
}

echo "Copying environment files from templates..."
echo ""

# ========================================
# BACKEND SERVICES
# ========================================

echo -e "${YELLOW}Backend Services:${NC}"
copy_env "api-gateway.env" "$PROJECT_ROOT/services/api-gateway/.env.production"
copy_env "unified-backend.env" "$PROJECT_ROOT/services/unified-backend/.env.production"
copy_env "embeddings-worker.env" "$PROJECT_ROOT/services/embeddings-worker/.env.production"
echo ""

# ========================================
# FRONTEND APPS
# ========================================

echo -e "${YELLOW}Frontend Apps:${NC}"
copy_env "landing.env" "$PROJECT_ROOT/apps/landing/.env.production"
copy_env "game.env" "$PROJECT_ROOT/apps/game/.env.production"
copy_env "documents.env" "$PROJECT_ROOT/apps/documents/.env.production"
copy_env "management.env" "$PROJECT_ROOT/apps/management/.env.production"
echo ""

# ========================================
# DONE
# ========================================

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ All environment files configured!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Environment files have been copied to:"
echo "  - services/*/. env.production"
echo "  - apps/*/.env.production"
echo ""
echo "Next steps:"
echo "  1. Build all services: ./deploy/build-all.sh"
echo "  2. Setup Nginx: ./deploy/setup-nginx.sh"
echo "  3. Generate SSL: sudo certbot --nginx -d [domains]"
echo "  4. Start PM2: ./deploy/setup-pm2.sh"
echo ""
