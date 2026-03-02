# Database Schema e Relazioni

## Panoramica

TenpennyNovels usa MongoDB con Mongoose ODM. Tutti i modelli sono definiti in `services/database/models/` e esportati tramite barrel export in `index.ts`.

## Modelli Principali

### User & Authentication
- **User**: Utenti del sistema
- **CharacterSession**: Sessioni character attive

### Character System
- **Character**: Personaggi giocatori (modello principale)
- **BackgroundQuestion**: Domande background guidato
- **Skill**: Skills disponibili nel sistema
- **Occupation**: Occupazioni disponibili
- **CharacterProgression**: Progressione personaggio (XP, livelli)

### Location System
- **Location**: Location del gioco (luoghi di Londra)
- **LocationAction**: Azioni disponibili in location

### Corporation System
- **Corporation**: Corporazioni e organizzazioni
- Include membri, ruoli, finanziamenti

### Item & Shop System
- **Item**: Oggetti del gioco
- **Shop**: Negozi nelle location
- **ShopItem**: Oggetti venduti nei negozi

### Economy System
- **CharacterWallet**: Portafoglio personaggio
- **FinancialTransaction**: Transazioni finanziarie
- **EconomicReport**: Report economici

### Messaging System
- **OnGameMessage**: Messaggi postal system vittoriano
- **OnGameMessageView**: Viste messaggi per destinatario
- **OffGameChat**: Chat out-of-character
- **OffGameChatMessage**: Messaggi chat OOC
- **LocationChatMessage**: Messaggi chat location

### Relationship System
- **Relationship**: Relazioni tra personaggi
- Include tipo relazione, proposta, azioni

### Housing System
- **HousingProperty**: Proprietà immobiliari
- **EstateTransaction**: Transazioni immobiliari

### Experience System
- **ExperienceGrant**: Concessioni esperienza
- **GamingSession**: Sessioni di gioco

### Ticketing System
- **Ticket**: Ticket di supporto
- **TicketMessage**: Messaggi nei ticket

### Financial System
- **CharacterFinances**: Finanze personaggio
- **SocialClassConfig**: Configurazione classi sociali

## Relazioni Principali

### Character Relationships
```
Character
├── userId (ObjectId → User)
├── currentLocationId (ObjectId → Location)
├── corporationId (ObjectId → Corporation) [opzionale]
└── relationships[] (ObjectId[] → Relationship)
```

### Location Relationships
```
Location
├── characters[] (ObjectId[] → Character) [virtual]
└── shop (ObjectId → Shop) [opzionale]
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

