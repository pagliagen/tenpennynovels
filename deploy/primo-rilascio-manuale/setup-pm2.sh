#!/bin/bash

# ========================================
# TenpennyNovels - Setup PM2
# ========================================
# This script starts all services with PM2 and configures auto-restart on boot

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
echo -e "${BLUE}TenpennyNovels - PM2 Setup${NC}"
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
# VERIFY DEPENDENCIES
# ========================================

print_header "Verifying Dependencies"

# Check MongoDB
echo "Checking MongoDB..."
if pgrep -x "mongod" > /dev/null; then
    print_status 0 "MongoDB is running"
else
    echo -e "${RED}❌ MongoDB is not running${NC}"
    echo "Start MongoDB first: sudo systemctl start mongod"
    exit 1
fi

# Check Redis
echo "Checking Redis..."
if pgrep -x "redis-server" > /dev/null; then
    print_status 0 "Redis is running"
else
    echo -e "${RED}❌ Redis is not running${NC}"
    echo "Start Redis first: sudo systemctl start redis"
    exit 1
fi

# Check Qdrant
echo "Checking Qdrant..."
if curl -s http://127.0.0.1:6333/health > /dev/null 2>&1; then
    print_status 0 "Qdrant is running"
else
    echo -e "${YELLOW}⚠️  Warning: Qdrant may not be running${NC}"
    echo "If you need embeddings functionality, start Qdrant first"
fi

# ========================================
# CREATE LOGS DIRECTORY
# ========================================

print_header "Creating Logs Directory"

mkdir -p "$PROJECT_ROOT/logs"
print_status 0 "Logs directory created"

# ========================================
# START PM2
# ========================================

print_header "Starting PM2 Services"

cd "$PROJECT_ROOT"

# Delete old PM2 processes if they exist
echo "Cleaning up old PM2 processes..."
pm2 delete all 2>/dev/null || true

# Start services with production environment
echo "Starting all services..."
pm2 start ecosystem.config.js --env production

print_status $? "All services started"

# ========================================
# SAVE PM2 CONFIGURATION
# ========================================

print_header "Saving PM2 Configuration"

pm2 save
print_status $? "PM2 configuration saved"

# ========================================
# SETUP PM2 STARTUP SCRIPT
# ========================================

print_header "Setting up PM2 Auto-Startup"

echo "This step requires sudo privileges."
echo ""

# Get the startup command
STARTUP_CMD=$(pm2 startup | grep "sudo")

if [ -n "$STARTUP_CMD" ]; then
    echo "Running: $STARTUP_CMD"
    eval "$STARTUP_CMD"
    print_status $? "PM2 startup script configured"
else
    echo -e "${YELLOW}⚠️  Could not generate PM2 startup command${NC}"
    echo "Run manually: pm2 startup"
fi

# ========================================
# DISPLAY STATUS
# ========================================

print_header "PM2 Status"

pm2 status

# ========================================
# DONE
# ========================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ PM2 setup completed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Useful PM2 commands:"
echo "  pm2 status              - Show all processes"
echo "  pm2 logs                - Show logs (all services)"
echo "  pm2 logs [app-name]     - Show logs for specific service"
echo "  pm2 restart all         - Restart all services"
echo "  pm2 restart [app-name]  - Restart specific service"
echo "  pm2 monit               - Real-time monitoring"
echo "  pm2 stop all            - Stop all services"
echo ""
