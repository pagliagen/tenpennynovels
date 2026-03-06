#!/bin/bash

# ========================================
# TenPennyNovels - Setup Nginx Configurations
# ========================================
# This script generates and installs HTTP-only Nginx configs for all frontend subdomains.
# After running this script, use certbot to add SSL/HTTPS.

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_CONFIGS_DIR="$PROJECT_ROOT/deploy/nginx-configs"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}TenPennyNovels - Nginx Setup${NC}"
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

# Create nginx-configs directory if it doesn't exist
mkdir -p "$NGINX_CONFIGS_DIR"

# ========================================
# GENERATE NGINX CONFIGURATIONS
# ========================================

print_header "Generating Nginx Configurations"

# Function to generate Nginx config
generate_nginx_config() {
    local name=$1
    local domain=$2
    local port=$3
    local file="$NGINX_CONFIGS_DIR/tenpennynovels-$name"

    cat > "$file" << EOF
# TenPennyNovels - $name Frontend
# Domain: $domain
# Proxy to: localhost:$port
#
# NOTE: This config contains only HTTP (port 80).
# After running 'sudo certbot --nginx -d $domain', certbot will:
# - Generate SSL certificates
# - Add HTTPS (port 443) configuration automatically
# - Add HTTP to HTTPS redirect

server {
    listen 80;
    server_name $domain;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
    gzip_disable "msie6";

    # Next.js Static Assets (1 year cache)
    location /_next/static/ {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable, max-age=31536000";
        access_log off;
    }

    # Next.js Image Optimization
    location /_next/image {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Public Assets
    location /public/ {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;
        add_header Cache-Control "public, max-age=3600";
    }

    # Main Application
    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;

        # Proxy Headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

    echo "Generated: tenpennynovels-$name"
}

# Generate configs for all frontend apps
generate_nginx_config "landing" "tenpennynovels.com" "4000"
generate_nginx_config "game" "game.tenpennynovels.com" "4001"
generate_nginx_config "documenti" "documenti.tenpennynovels.com" "4003"
generate_nginx_config "gestione" "gestione.tenpennynovels.com" "4004"

print_status 0 "All Nginx configurations generated"

# ========================================
# INSTALL NGINX CONFIGURATIONS
# ========================================

print_header "Installing Nginx Configurations"

echo "This step requires sudo privileges."
echo ""

# Copy files to /etc/nginx/sites-enabled/
for config_file in "$NGINX_CONFIGS_DIR"/tenpennynovels-*; do
    filename=$(basename "$config_file")
    echo "Installing $filename..."
    sudo cp "$config_file" "/etc/nginx/sites-enabled/$filename"
    print_status $? "$filename installed"
done

# ========================================
# TEST NGINX CONFIGURATION
# ========================================

print_header "Testing Nginx Configuration"

sudo nginx -t
print_status $? "Nginx configuration test passed"

# ========================================
# RELOAD NGINX
# ========================================

print_header "Reloading Nginx"

sudo systemctl reload nginx
print_status $? "Nginx reloaded successfully"

# ========================================
# DONE
# ========================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Nginx HTTP configs installed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  NEXT STEP: Generate SSL Certificates${NC}"
echo ""
echo "The Nginx configs are currently HTTP-only (port 80)."
echo "Now run certbot to generate SSL certificates."
echo ""
echo "Certbot will automatically:"
echo "  1. Generate Let's Encrypt SSL certificates"
echo "  2. Add HTTPS (443) configuration to each Nginx file"
echo "  3. Add HTTP → HTTPS redirect"
echo ""
echo "Run these commands:"
echo ""
echo "  sudo certbot --nginx -d tenpennynovels.com"
echo "  sudo certbot --nginx -d game.tenpennynovels.com"
echo "  sudo certbot --nginx -d documenti.tenpennynovels.com"
echo "  sudo certbot --nginx -d gestione.tenpennynovels.com"
echo ""
echo "After certbot completes, your sites will be accessible via HTTPS."
echo ""
