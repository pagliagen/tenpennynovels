#!/bin/bash

# ========================================
# TenpennyNovels - Build All Services
# ========================================
# This script builds all backend services and frontend apps

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}TenpennyNovels - Build All Services${NC}"
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

# Function to print section header
print_header() {
    echo ""
    echo -e "${YELLOW}▶ $1${NC}"
    echo "----------------------------------------"
}

# ========================================
# 1. BACKEND SERVICES BUILD
# ========================================

print_header "Building Backend Services"

# API Gateway
echo "Building api-gateway..."
cd "$PROJECT_ROOT/services/api-gateway"
npm install
npm run build
print_status $? "api-gateway built successfully"

# Unified Backend
echo "Building unified-backend..."
cd "$PROJECT_ROOT/services/unified-backend"
npm install
npm run build
print_status $? "unified-backend built successfully"

# NOTE: botai-backend is NOT deployed on VPS - runs via ngrok on local machine

# Embeddings Worker
echo "Building embeddings-worker..."
cd "$PROJECT_ROOT/services/embeddings-worker"
npm install
npm run build
print_status $? "embeddings-worker built successfully"

# Embeddings Worker - Python dependencies
echo "Setting up Python for embeddings-worker..."
cd "$PROJECT_ROOT/services/embeddings-worker/python"
pip3 install -r requirements.txt
python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"
print_status $? "embeddings-worker Python setup successfully"

# ========================================
# 2. COPY ENVIRONMENT FILES
# ========================================

print_header "Copying .env.production files"

# Copy .env templates for all services and apps
echo "Copying backend .env templates..."
cp "$PROJECT_ROOT/deploy/env-templates/unified-backend.env" "$PROJECT_ROOT/services/unified-backend/.env.production"
cp "$PROJECT_ROOT/deploy/env-templates/embeddings-worker.env" "$PROJECT_ROOT/services/embeddings-worker/.env.production"
cp "$PROJECT_ROOT/deploy/env-templates/api-gateway.env" "$PROJECT_ROOT/services/api-gateway/.env.production"
print_status $? "Backend .env files copied"

echo "Copying frontend .env templates..."
cp "$PROJECT_ROOT/deploy/env-templates/landing.env" "$PROJECT_ROOT/apps/landing/.env.production"
cp "$PROJECT_ROOT/deploy/env-templates/game.env" "$PROJECT_ROOT/apps/game/.env.production"
cp "$PROJECT_ROOT/deploy/env-templates/documents.env" "$PROJECT_ROOT/apps/documents/.env.production"
cp "$PROJECT_ROOT/deploy/env-templates/management.env" "$PROJECT_ROOT/apps/management/.env.production"
print_status $? "Frontend .env files copied"

echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env.production files and update secrets before starting PM2!${NC}"

# ========================================
# 3. FRONTEND APPS BUILD
# ========================================

print_header "Building Frontend Apps"

# Landing
echo "Building landing app..."
cd "$PROJECT_ROOT/apps/landing"
npm install
npm run build
print_status $? "landing built successfully"

# Game
echo "Building game app..."
cd "$PROJECT_ROOT/apps/game"
npm install
npm run build
print_status $? "game built successfully"

# Documents
echo "Building documents app..."
cd "$PROJECT_ROOT/apps/documents"
npm install
npm run build
print_status $? "documents built successfully"

# Management
echo "Building management app..."
cd "$PROJECT_ROOT/apps/management"
npm install
npm run build
print_status $? "management built successfully"

# ========================================
# 4. LINK ENV FILES
# ========================================

print_header "Linking .env files"

# Run link-env.sh to create symlinks
cd "$PROJECT_ROOT"
./deploy/link-env.sh
print_status $? "Environment files linked"

# ========================================
# DONE
# ========================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ All builds completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Configure .env.production files (see deploy/env-templates/)"
echo "2. Setup Nginx: ./deploy/setup-nginx.sh"
echo "3. Start PM2: ./deploy/setup-pm2.sh"
echo ""
