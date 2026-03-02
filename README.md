# TenpennyNovels

**Victorian London RPG by Chat Platform**
*Experience immersive roleplay in Victorian London using Call of Cthulhu Rules*

TenpennyNovels is a comprehensive web-based RPG platform that brings Victorian London to life through real-time chat gameplay, character management, and collaborative storytelling.

## Features

- **Authentic Victorian Experience**: Play in historically accurate 1890s London
- **Call of Cthulhu System**: Full character creation with Victorian-era occupations
- **Real-time Gameplay**: WebSocket-powered chat with dice rolling and character interactions
- **Multiple Gaming Modes**:
  - Location-based in-character chat
  - Victorian postal system for messages
  - Out-of-character chat for players
- **Rich Document System**: Access setting guides, rules, and historical information
- **Community Forum**: Discuss storylines and coordinate with other players
- **Character Management**: Create, develop, and track your Victorian character
- **Admin Tools**: Comprehensive management interface for game masters

## Technology Stack

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Node.js, Express, TypeScript
- **Real-time**: Socket.io for WebSocket connections
- **Database**: MongoDB with Redis caching
- **Authentication**: NextAuth.js with JWT tokens

## Architecture

### Multi-Application Design
The platform consists of 6 frontend applications and 4 backend microservices:

**Frontend Applications:**
- **Landing**: Authentication and character selection
- **Game**: Main gameplay interface with real-time chat
- **Documents**: Setting guides and rules reference
- **Forum**: Community discussions
- **Management**: Game master tools
- **Tickets**: Player support system

**Backend Services:**
- **API Gateway**: Centralized routing (Port 8000)
- **Authentication**: User management and security (Port 3000)
- **Game Backend**: Gameplay logic and WebSocket (Port 3001)
- **Management Backend**: Administrative functions (Port 3002)

### Event-Driven Architecture
Services communicate via Redis pub/sub for real-time features and loosely coupled microservices.

## Quick Start

### Prerequisites
- Node.js v22.13.1
- MongoDB v6.x or higher
- Redis v7.x or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/pagliagen/tenpennynovels.git
cd tenpennynovels

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start services (choose one method)

# Method 1: Docker (recommended)
npm run docker:all:start    # Starts MongoDB, Redis, and all backends

# Method 2: Local services
npm run all                 # Starts all services locally
```

### Access the Platform

After starting the services:
- **Landing/Login**: http://localhost:4000
- **Game Interface**: http://localhost:4001
- **Documents**: http://localhost:4002
- **Forum**: http://localhost:4003
- **Management**: http://localhost:4004

For detailed installation instructions, see [docs/technical.md](docs/technical.md).

## Development

### Start Development Environment

#### Option 1: Docker (Recommended for Backend)

Docker provides an isolated development environment with hot-reload support:

```bash
# Start infrastructure + all backend services
npm run docker:all:start

# Stop all services
npm run docker:all:stop

# Infrastructure only (MongoDB, Redis, Embeddings)
npm run docker:infra:start
npm run docker:infra:stop

# Backend services only
# ⚠️ Note: Infrastructure must be running first!
npm run docker:backends:start
npm run docker:backends:stop

# Check infrastructure health before starting backends
npm run docker:check

# View logs - all backends
npm run docker:logs

# View logs - individual backend
npm run docker:logs:gateway      # API Gateway
npm run docker:logs:auth         # Authentication Backend
npm run docker:logs:game         # Game Backend
npm run docker:logs:management   # Management Backend

# Check status
npm run docker:status

# Restart services
npm run docker:restart
```

**⚠️ Important: Docker Startup Order**

When starting services manually, always start infrastructure before backends:
1. ✅ **Correct:** Use `npm run docker:all:start` (handles everything automatically)
2. ✅ **Correct:** Run `npm run docker:infra:start`, wait 30 seconds, then `npm run docker:backends:start`
3. ❌ **Incorrect:** Running `npm run docker:backends:start` without infrastructure will fail

Use `npm run docker:check` to verify infrastructure is ready before starting backends.

**Available Services (Docker):**
- API Gateway: http://localhost:8000
- Auth Backend: http://localhost:3000
- Game Backend: http://localhost:3001
- Management Backend: http://localhost:3002
- MongoDB Express: http://localhost:8082
- Redis Commander: http://localhost:8081

**Hot-Reload:** Code changes are automatically detected and services restart in 1-2 seconds.

#### Option 2: Local Services

Run services directly on your machine:

```bash
# Start all services and applications
npm run all

# Or start services individually
npm run backend:all      # All backend services
npm run frontend:all     # All frontend applications
```

### Build for Production

```bash
# Build all applications
npm run build

# Run tests
npm run test
```

## Project Structure

```
tenpennynovels/
├── apps/                    # Frontend applications (6 sites)
│   ├── landing/            # Login and character selection
│   ├── game/               # Main game interface
│   ├── documents/          # Document management
│   ├── forum/              # Community forum
│   ├── management/         # Admin interface
│   └── tickets/            # Support system
├── services/               # Backend Services + Shared Code
│   ├── api-gateway/        # Central routing
│   ├── authentication-backend/
│   ├── game-backend/
│   ├── management-backend/
│   ├── shared/            # Shared utilities, types, models
│   ├── database/          # MongoDB models (33+ models)
│   └── config/            # Configuration files (JSON)
└── docs/                  # Complete documentation
    ├── technical.md       # Technical documentation
    ├── api-docs.md        # API documentation
    ├── architecture/      # Architecture guides
    ├── systems/           # System documentation
    ├── gameplay/          # Game mechanics
    ├── setup/             # Setup and development guides
    └── deployment/        # Deployment guides
```

## Docker Development Setup

The project includes Docker configuration for streamlined backend development with full hot-reload support.

### Features

- ✅ **Hot-reload**: Code changes trigger automatic restart (1-2 seconds)
- ✅ **Isolated environment**: Consistent across all developers
- ✅ **Easy infrastructure**: MongoDB, Redis, and all backends with one command
- ✅ **Individual logs**: View logs for specific services without grep
- ✅ **Network isolation**: Services communicate via Docker network

### Docker Files

- `docker-compose.infrastructure.yml` - MongoDB, Redis, Embeddings
- `docker-compose.backends.yml` - All 4 backend services (Auth, Game, Management, API Gateway)
- `services/*/Dockerfile.dev` - Development Dockerfiles with tsx watch
- `docker-backends.sh` - Management script for lifecycle operations

### Advanced Docker Commands

```bash
# Using the management script directly
./docker-backends.sh start                          # Start everything
./docker-backends.sh stop                           # Stop everything
./docker-backends.sh restart                        # Restart all
./docker-backends.sh restart tenpennynovels-game-backend  # Restart single service
./docker-backends.sh logs tenpennynovels-auth-backend     # Logs for specific service
./docker-backends.sh rebuild                        # Rebuild images from scratch

# Build backends manually
npm run docker:backends:build

# Hybrid mode (infrastructure in Docker, backends local)
npm run docker:infra:start && npm run backend:all
```

### Troubleshooting Docker

```bash
# Check container status
docker ps -a

# View detailed logs
docker logs tenpennynovels-game-backend

# Restart a misbehaving service
docker restart tenpennynovels-auth-backend

# Clean rebuild if needed
docker-compose -f docker-compose.backends.yml down
docker-compose -f docker-compose.backends.yml build --no-cache
docker-compose -f docker-compose.backends.yml up -d
```

## Documentation

- **[docs/setup/development-guide.md](docs/setup/development-guide.md)**: Complete development guide and architecture overview
- **[docs/technical.md](docs/technical.md)**: Detailed technical documentation
- **[docs/api-docs.md](docs/api-docs.md)**: Complete API documentation with standardized response format
- **[docs/deployment/](docs/deployment/)**: Production deployment guides
- **[docs/architecture/](docs/architecture/)**: Architecture documentation
- **[docs/systems/](docs/systems/)**: System-specific guides
- **[docs/gameplay/](docs/gameplay/)**: Game mechanics documentation

## Security

- JWT-based authentication with secure HttpOnly cookies
- Two-tier authorization system (user and character roles)
- Server-side validation and authorization checks
- Rate limiting and input sanitization
- HTTPS enforcement in production

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## Testing

```bash
# Run all tests
npm run test

# Run specific test suites
npm run test:backend      # Backend services
npm run test:frontend     # Frontend applications
npm run test:integration  # Integration tests
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/pagliagen/tenpennynovels/issues)
- **Discussions**: [GitHub Discussions](https://github.com/pagliagen/tenpennynovels/discussions)
- **Documentation**: See [docs/](docs/) directory

---

Made with ❤️ for Victorian London RPG enthusiasts
