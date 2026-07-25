# Database Schema e Relazioni

## Panoramica

TenPennyNovels usa MongoDB con Mongoose ODM. Tutti i modelli sono definiti in `services/unified-backend/src/database/models/` e esportati tramite barrel export in `index.ts`.

## Modelli Principali

### User & Authentication
- **User**: Utenti del sistema
- **CharacterSession**: Sessioni character attive

### Character System
- **Character**: Personaggi giocatori (modello principale)
- **Skill**: Skills disponibili nel sistema
- **Occupation**: Occupazioni disponibili
- **CharacterProgression**: Progressione personaggio (XP, livelli)
- **CharacterRelation**: Relazioni tra personaggi (tipo, proposta, azioni)
- **CharacterNotes**: Appunti personaggio (opzionalmente legati a una location)
- **CharacterFinances**: Finanze personaggio

### Location System
- **Location**: Location del gioco (luoghi di Londra)
- **Chat**: Messaggi chat nelle location (azioni, dadi, conflitti sociali)
- **LocationProperty**: Proprietà immobiliari associate a location

### Corporation System
- **Corporation**: Corporazioni e organizzazioni
- Include membri, ruoli, finanziamenti

### Item & Shop System
- **Item**: Oggetti del gioco
- **Shop**: Negozi nelle location
- **ShopItem**: Oggetti venduti nei negozi

### Messaging System
- **OnGameMessage**: Messaggi postal system vittoriano
- **OnGameMessageView**: Viste messaggi per destinatario
- **OffGameChat**: Chat out-of-character
- **OffGameChatMessage**: Messaggi chat OOC

### Session & Gaming System
- **GamingSession**: Sessioni di gioco
- **SessionManagement**: Dati estesi gestione sessione
- **SessionTemplate**: Template per sessioni

### Ticketing System
- **Ticket**: Ticket di supporto
- **TicketMessage**: Messaggi nei ticket
- **TicketNotification**: Notifiche ticket

### Financial System
- **SocialClassConfig**: Configurazione classi sociali

### Chat Moderation System
- **ChatModerationAction**: Azioni moderazione chat
- **MessageReport**: Segnalazioni messaggi
- **UserReport**: Segnalazioni utenti

### Knowledge Base System
- **Document**: Documenti ambientazione/regolamento
- **DocumentSubtype**: Sottotipi documenti
- **DocumentChunk**: Chunk documenti per embedding

### Forum System
- **ForumTopic**: Topic del forum
- **ForumDiscussion**: Discussioni
- **ForumPost**: Post nel forum

### System
- **SystemConfiguration**: Configurazione sistema
- **BroadcastMessage**: Messaggi broadcast
- **WebSocketEvent**: Eventi WebSocket replay
- **AuditLog**: Log di audit
- **DeletedRecord**: Archivio record eliminati

## Relazioni Principali

### Character Relationships
```
Character
├── userId (ObjectId → User)
├── currentLocationId (ObjectId → Location)
├── corporationId (ObjectId → Corporation) [opzionale]
└── relations (via CharacterRelation)
```

### Location Relationships
```
Location
├── characters[] (ObjectId[] → Character) [virtual]
├── shop (ObjectId → Shop) [opzionale]
└── property (via LocationProperty)
```

### Corporation Relationships
```
Corporation
├── members[] (ObjectId[] → Character)
└── ownerId (ObjectId → Character)
```

### Message Relationships
```
OnGameMessage
├── fromCharacterId (ObjectId → Character)
└── toCharacterIds[] (ObjectId[] → Character)

OnGameMessageView
├── messageId (ObjectId → OnGameMessage)
└── characterId (ObjectId → Character)
```

## Index per Performance

### Character
- `userId`: Index per query personaggi utente
- `status`: Index per query personaggi approvati
- `currentLocationId`: Index per query personaggi in location

### Location
- `slug`: Index unico per lookup rapido
- `visible`: Index per query location visibili

### Chat
- `locationId, timestamp`: Index per storico chat location
- `characterId, timestamp`: Index per storico chat personaggio
- `timestamp`: TTL index (auto-delete dopo 30 giorni)

### OnGameMessage
- `fromCharacterId`: Index per query messaggi inviati
- `toCharacterIds`: Index per query messaggi ricevuti
- `createdAt`: Index per ordinamento temporale

## Best Practices

1. **Usa sempre ObjectId** per riferimenti tra modelli
2. **Definisci index** per query frequenti
3. **Usa virtual populate** per relazioni non denormalizzate
4. **Valida sempre** campi obbligatori nello schema
5. **Usa timestamps** per createdAt/updatedAt automatici

## Migrazioni

Per modifiche schema esistenti:
1. Crea migration script in `scripts/migrations/`
2. Gestisci migrazione dati se necessario
3. Aggiorna modelli e tipi TypeScript
4. Testa migrazione su database di sviluppo
