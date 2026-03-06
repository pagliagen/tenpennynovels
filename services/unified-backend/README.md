# TenPennyNovels Unified Backend

Backend unificato con architettura modulare che gestisce tutte le app frontend.

## Struttura

```
unified-backend/
├── src/
│   ├── database/          # Modelli MongoDB condivisi
│   ├── shared/            # Utilities condivise (logger, middleware, ecc.)
│   ├── config/            # Configurazioni condivise
│   └── modules/           # Moduli per ogni app frontend
│       ├── auth/          # Authentication (usato da tutte le app)
│       ├── game/          # Game app backend
│       ├── documents/     # Documents app backend
│       ├── tickets/       # Tickets app backend
│       ├── forum/         # Forum app backend
│       └── admin/         # Management panel backend
├── logs/                  # Log files (gitignored)
├── app.ts                 # Main Express application
└── server.ts              # Server entry point
```

## Logging

Ogni modulo ha il proprio logger con tag automatico:

```typescript
// In qualsiasi file del modulo 'game'
import { logger } from '../logger';

logger.info('Character joined location');
// Output: 2026-02-22 18:30:00 [game] info: Character joined location

logger.error('Database connection failed', { error });
// Output: 2026-02-22 18:30:01 [game] error: Database connection failed
```

### Log Files

- `logs/combined.log` - Tutti i log di tutti i moduli
- `logs/error.log` - Solo errori di tutti i moduli
- `logs/[module].log` - Log specifici per ogni modulo (auth.log, game.log, ecc.)

### Filtrare Log

```bash
# Solo log del modulo game
grep "\[game\]" logs/combined.log

# Solo errori del modulo auth
grep "\[auth\]" logs/error.log

# Real-time filtering
tail -f logs/combined.log | grep "\[documents\]"
```

## Path Aliases

Il progetto usa TypeScript path aliases per import puliti:

- `@database/*` → `src/database/*`
- `@shared/*` → `src/shared/*`
- `@config/*` → `src/config/*`
- `@modules/*` → `src/modules/*`

Esempio:
```typescript
import { User } from '@database/models';
import { logger } from '@shared/utils/logger';
import permissions from '@config/permissions.json';
```

## Sviluppo

```bash
# Install dependencies
npm install

# Development mode (hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type check only
npm run type-check
```

## Environment Variables

Vedi `.env` nel root del progetto per le variabili d'ambiente necessarie.

## Note Architetturali

- Ogni modulo è **indipendente** dagli altri moduli
- I moduli condividono **solo** database, shared, config
- **NO** import cross-module (es. game non può importare da documents)
- Comunicazione tra moduli tramite **database events** o **Redis pub/sub**
