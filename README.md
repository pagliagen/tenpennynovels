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

# Initialize database
npm run db:migrate
npm run db:seed

# Start all services
npm run dev:all
```

### Access the Platform

After starting the services:
- **Landing/Login**: http://localhost:4000
- **Game Interface**: http://localhost:4001
- **Documents**: http://localhost:4002
- **Forum**: http://localhost:4003
- **Management**: http://localhost:4004

For detailed installation instructions, see [docs/TECHNICAL.md](docs/TECHNICAL.md).

## Development

### Start Development Environment

```bash
# Start all services and applications
npm run dev:all

# Or start services individually
npm run dev:backend      # All backend services
npm run dev:frontend     # All frontend applications
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
├── services/               # Backend microservices (4 services)
│   ├── api-gateway/        # Central routing
│   ├── authentication-backend/
│   ├── game-backend/
│   └── management-backend/
├── packages/
│   ├── shared/            # Common utilities
│   ├── database/          # Database models
│   └── shared-ui/         # UI components
└── docs/                  # Documentation
    ├── TECHNICAL.md       # Technical documentation
    ├── architecture/      # Architecture guides
    ├── systems/           # System documentation
    └── gameplay/          # Game mechanics
```

## Documentation

- **[CLAUDE.md](CLAUDE.md)**: Development guidelines and architecture overview
- **[docs/TECHNICAL.md](docs/TECHNICAL.md)**: Detailed technical documentation
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
