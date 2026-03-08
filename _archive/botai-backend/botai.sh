#!/bin/bash

# BotAI Backend Management Script
# Usage: ./botai.sh [start|stop|restart|status] [dev|prod]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  BotAI Backend - $1"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
}

# Check if embeddings service is running
check_embeddings() {
    if docker ps | grep -q "botai-embeddings"; then
        return 0
    else
        return 1
    fi
}

# Start embeddings service
start_embeddings() {
    if check_embeddings; then
        print_success "Embeddings service già running"
    else
        print_info "Avvio embeddings service (shared)..."
        docker-compose -f docker-compose.embeddings.yml up -d
        sleep 3
        if check_embeddings; then
            print_success "Embeddings service avviato (porta 5002)"
        else
            print_error "Errore avvio embeddings service"
            exit 1
        fi
    fi
}

# Stop embeddings service
stop_embeddings() {
    if check_embeddings; then
        print_info "Stop embeddings service..."
        docker-compose -f docker-compose.embeddings.yml down
        print_success "Embeddings service fermato"
    fi
}

# Start dev environment
start_dev() {
    print_header "Development Mode"

    # Set .env symlink
    print_info "Configurazione ambiente: development"
    ln -sf .env.development .env
    print_success ".env → .env.development"

    # Start embeddings
    start_embeddings

    # Start dev services
    print_info "Avvio BotAI Backend (dev)..."
    docker-compose -f docker-compose.dev.yml up -d

    # Wait for services
    sleep 5

    # Check status
    print_success "BotAI Backend (dev) avviato"
    echo ""
    print_info "Servizi attivi:"
    echo "  • BotAI Backend:  http://localhost:8082"
    echo "  • MongoDB:        localhost:27020"
    echo "  • Embeddings:     http://localhost:5002"
    echo ""
    print_info "Logs: docker logs -f botai-backend-dev"
}

# Start prod environment
start_prod() {
    print_header "Production Mode"

    # Set .env symlink
    print_info "Configurazione ambiente: production"
    ln -sf .env.production .env
    print_success ".env → .env.production"

    # Start embeddings
    start_embeddings

    # Start prod services
    print_info "Avvio BotAI Backend (prod)..."
    docker-compose -f docker-compose.prod.yml up -d

    # Wait for services
    sleep 5

    # Check status
    print_success "BotAI Backend (prod) avviato"
    echo ""
    print_info "Servizi attivi:"
    echo "  • BotAI Backend:  http://localhost:8080"
    echo "  • MongoDB:        localhost:27019"
    echo "  • Embeddings:     http://localhost:5002"
    echo ""
    print_info "Logs: docker logs -f botai-backend-prod"
}

# Stop dev environment
stop_dev() {
    print_header "Stop Development"
    print_info "Stop BotAI Backend (dev)..."
    docker-compose -f docker-compose.dev.yml down
    print_success "Development environment fermato"
}

# Stop prod environment
stop_prod() {
    print_header "Stop Production"
    print_info "Stop BotAI Backend (prod)..."
    docker-compose -f docker-compose.prod.yml down
    print_success "Production environment fermato"
}

# Stop all
stop_all() {
    print_header "Stop All Services"
    stop_dev 2>/dev/null || true
    stop_prod 2>/dev/null || true
    stop_embeddings
    print_success "Tutti i servizi fermati"
}

# Show status
show_status() {
    print_header "Service Status"

    echo -e "${BLUE}Embeddings Service:${NC}"
    if check_embeddings; then
        print_success "Running (porta 5002)"
    else
        print_warning "Not running"
    fi

    echo ""
    echo -e "${BLUE}Development:${NC}"
    if docker ps | grep -q "botai-backend-dev"; then
        print_success "Running (porta 8082)"
    else
        print_warning "Not running"
    fi

    echo ""
    echo -e "${BLUE}Production:${NC}"
    if docker ps | grep -q "botai-backend-prod"; then
        print_success "Running (porta 8080)"
    else
        print_warning "Not running"
    fi

    echo ""
    echo -e "${BLUE}Containers attivi:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep botai || echo "  Nessun container BotAI attivo"
}

# Show usage
show_usage() {
    echo "Usage: ./botai.sh [command] [environment]"
    echo ""
    echo "Commands:"
    echo "  start [dev|prod]   - Avvia ambiente specificato"
    echo "  stop [dev|prod]    - Ferma ambiente specificato"
    echo "  stop all           - Ferma tutti i servizi"
    echo "  restart [dev|prod] - Riavvia ambiente specificato"
    echo "  status             - Mostra stato servizi"
    echo ""
    echo "Examples:"
    echo "  ./botai.sh start dev      # Avvia development"
    echo "  ./botai.sh start prod     # Avvia production"
    echo "  ./botai.sh stop all       # Ferma tutto"
    echo "  ./botai.sh restart dev    # Riavvia dev"
    echo "  ./botai.sh status         # Mostra stato"
}

# Main
COMMAND=${1:-help}
ENV=${2:-}

case "$COMMAND" in
    start)
        case "$ENV" in
            dev)
                start_dev
                ;;
            prod)
                start_prod
                ;;
            *)
                print_error "Specifica ambiente: dev o prod"
                show_usage
                exit 1
                ;;
        esac
        ;;

    stop)
        case "$ENV" in
            dev)
                stop_dev
                ;;
            prod)
                stop_prod
                ;;
            all)
                stop_all
                ;;
            *)
                print_error "Specifica ambiente: dev, prod, o all"
                show_usage
                exit 1
                ;;
        esac
        ;;

    restart)
        case "$ENV" in
            dev)
                stop_dev
                sleep 2
                start_dev
                ;;
            prod)
                stop_prod
                sleep 2
                start_prod
                ;;
            *)
                print_error "Specifica ambiente: dev o prod"
                show_usage
                exit 1
                ;;
        esac
        ;;

    status)
        show_status
        ;;

    help|--help|-h)
        show_usage
        ;;

    *)
        print_error "Comando sconosciuto: $COMMAND"
        show_usage
        exit 1
        ;;
esac
