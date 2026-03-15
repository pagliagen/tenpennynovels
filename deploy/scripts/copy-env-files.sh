#!/bin/bash
# ========================================
# TenPennyNovels - Copy Production ENV Files
# ========================================
# Copies env templates from deploy/env-templates/
# to the correct app/service directories as .env.production files

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root (adjust if running from different location)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE_DIR="$PROJECT_ROOT/deploy/env-templates"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}TenPennyNovels - Copy ENV Files${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Project root: $PROJECT_ROOT"
echo "Template dir: $TEMPLATE_DIR"
echo ""

# Check if template directory exists
if [ ! -d "$TEMPLATE_DIR" ]; then
    echo -e "${RED}❌ Template directory not found: $TEMPLATE_DIR${NC}"
    exit 1
fi

# Counter for stats
COPIED=0
BACKED_UP=0
SKIPPED=0

# Function to copy env file
copy_env() {
    local TEMPLATE_FILE="$1"
    local TARGET_DIR="$2"
    local TARGET_FILENAME="$3"
    local DESCRIPTION="$4"

    local SOURCE="$TEMPLATE_DIR/$TEMPLATE_FILE"
    local TARGET="$PROJECT_ROOT/$TARGET_DIR/$TARGET_FILENAME"

    echo -e "${YELLOW}➜${NC} $DESCRIPTION"
    echo "  Source: $TEMPLATE_FILE"
    echo "  Target: $TARGET_DIR/$TARGET_FILENAME"

    # Check if source exists
    if [ ! -f "$SOURCE" ]; then
        echo -e "  ${RED}✗ Source file not found${NC}"
        SKIPPED=$((SKIPPED + 1))
        echo ""
        return
    fi

    # Check if target directory exists
    if [ ! -d "$PROJECT_ROOT/$TARGET_DIR" ]; then
        echo -e "  ${RED}✗ Target directory not found${NC}"
        SKIPPED=$((SKIPPED + 1))
        echo ""
        return
    fi

    # Backup existing file if present
    if [ -f "$TARGET" ]; then
        BACKUP="$TARGET.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$TARGET" "$BACKUP"
        echo -e "  ${BLUE}📦 Backed up existing file to: $(basename $BACKUP)${NC}"
        BACKED_UP=$((BACKED_UP + 1))
    fi

    # Copy file
    cp "$SOURCE" "$TARGET"
    chmod 600 "$TARGET"  # Secure permissions
    echo -e "  ${GREEN}✓ Copied successfully${NC}"
    COPIED=$((COPIED + 1))
    echo ""
}

echo -e "${BLUE}Copying environment files...${NC}"
echo ""

# ========================================
# APPS
# ========================================
copy_env "landing.env" "apps/landing" ".env.production" "Landing App"
copy_env "game.env" "apps/game" ".env.production" "Game App"
copy_env "documents.env" "apps/documents" ".env.production" "Documents App"
copy_env "management.env" "apps/management" ".env.production" "Management App"

# ========================================
# SERVICES
# ========================================
copy_env "api-gateway.env" "services/api-gateway" ".env.production" "API Gateway Service"
copy_env "unified-backend.env" "services/unified-backend" ".env.production" "Unified Backend Service"
copy_env "embeddings-worker.env" "services/embeddings-worker" ".env.production" "Embeddings Worker Service (Unified)"

# ========================================
# SUMMARY
# ========================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Copied:    $COPIED files${NC}"
if [ $BACKED_UP -gt 0 ]; then
    echo -e "${BLUE}📦 Backed up: $BACKED_UP files${NC}"
fi
if [ $SKIPPED -gt 0 ]; then
    echo -e "${YELLOW}⊘ Skipped:   $SKIPPED files${NC}"
fi
echo ""

if [ $COPIED -eq 0 ]; then
    echo -e "${RED}❌ No files were copied. Check the errors above.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment files copied successfully!${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "   1. Review the copied .env.production files"
echo "   2. Update any secrets/passwords if needed"
echo "   3. Rebuild apps with: npm run build"
echo "   4. Restart PM2 services: pm2 restart all"
echo ""
