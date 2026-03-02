# Shared Services & Utilities

Questa directory contiene codice condiviso tra tutti i servizi backend.

## Struttura

```
services/shared/
├── src/
│   ├── decorators/      # Decoratori TypeScript (ApiDoc, etc.)
│   ├── routes/          # Route condivise (API docs, etc.)
│   ├── services/        # Servizi condivisi
│   └── utils/           # Utility functions
├── types/               # Tipi TypeScript condivisi (vedi types/README.md)
└── utils/               # Utility condivise (character visibility, etc.)
```

## Componenti Principali

### Decorators
- `ApiDoc`: Decoratore per documentazione API automatica
- Usato per generare documentazione API da codice

### Services
- `CharacterCreationConfigService`: Servizio per configurazione creazione personaggi
- Gestisce stats, skills, occupation bonuses

### Utils
- `characterVisibility`: Utility per filtraggio visibilità personaggi
- `embeddings`: Helper per servizio embeddings

## Utilizzo

Importa da `services/shared`:
```typescript
import { CharacterCreationConfigService } from '../../../shared/src/services/CharacterCreationConfigService';
import { CharacterVisibilityFilter } from '../../../shared/utils/characterVisibility';
```

## Note Importanti

- **Shared Code**: Solo codice usato da più servizi
- **No Dependencies**: Evita dipendenze da servizi specifici
- **Type Safety**: Usa sempre TypeScript strict
- **Documentation**: Documenta sempre API pubbliche

