# WebSocket System

## Panoramica

TenPennyNovels usa Socket.io per gestire connessioni WebSocket real-time per chat location, notifiche e aggiornamenti gameplay.

## Architettura

### Server Side
- WebSocket server gestito da Game Backend
- Porta configurabile (default 3005)
- Integrazione con Express server

### Client Side
- Socket.io client nelle app frontend
- Connessione persistente durante sessione
- Auto-reconnect su disconnessione

## Eventi Principali

### Connection Events
- `connection` - Nuova connessione client
- `disconnect` - Client disconnesso

### Authentication
- `authenticate` - Autentica socket con character session
- `authenticated` - Conferma autenticazione riuscita

### Location Chat
- `join-location` - Client entra in location chat
- `leave-location` - Client esce da location chat
- `location-message` - Nuovo messaggio in location
- `location-message-broadcast` - Broadcast messaggio a tutti in location

### Character Events
- `character-joined-location` - Character entra in location
- `character-left-location` - Character esce da location
- `character-updated` - Aggiornamento dati character

### Notifications
- `notification` - Notifica per character
- `notification-read` - Notifica letta

## Pattern di Utilizzo

### Server Side (Game Backend)

```typescript
import { Server } from 'socket.io';

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true
  }
});

io.on('connection', (socket) => {
  // Autenticazione
  socket.on('authenticate', async (data) => {
    const { characterSessionId } = data;
    // Verifica session
    // Aggiungi characterId a socket.data
  });

  // Join location
  socket.on('join-location', (locationId) => {
    socket.join(`location:${locationId}`);
  });

  // Leave location
  socket.on('leave-location', (locationId) => {
    socket.leave(`location:${locationId}`);
  });

  // Broadcast message
  socket.on('location-message', (data) => {
    io.to(`location:${data.locationId}`).emit('location-message-broadcast', data);
  });
});
```

### Client Side (Frontend)

```typescript
import io from 'socket.io-client';

const socket = io(WS_URL, {
  withCredentials: true
});

// Autentica
socket.emit('authenticate', { characterSessionId });

// Join location
socket.emit('join-location', locationId);

// Ascolta messaggi
socket.on('location-message-broadcast', (message) => {
  // Aggiorna UI
});

// Invia messaggio
socket.emit('location-message', {
  locationId,
  content,
  characterId
});
```

## Room Management

### Location Rooms
- Ogni location ha una room: `location:${locationId}`
- Client si uniscono quando entrano in location
- Messaggi broadcast solo a room specifica

### Character Rooms
- Room per character: `character:${characterId}`
- Usato per notifiche personalizzate
- Aggiornamenti stato character

## Integrazione con Redis

### Pub/Sub Events
- Eventi pubblicati su Redis per altri servizi
- Altri servizi possono reagire a eventi WebSocket
- Decoupling tra servizi

### Pattern
```typescript
// Pubblica evento su Redis
await redis.publish('websocket:character-joined-location', {
  characterId,
  locationId,
  timestamp: new Date().toISOString()
});
```

## Best Practices

1. **Autenticazione** - Sempre autentica socket prima di operazioni
2. **Room Management** - Usa room per isolare eventi
3. **Error Handling** - Gestisci errori connessione gracefully
4. **Rate Limiting** - Limita frequenza eventi da client
5. **Validation** - Valida sempre dati da client
6. **Logging** - Log eventi importanti per debugging

## Note Importanti

- **CORS**: Configura CORS correttamente per produzione
- **Scaling**: Considera Redis adapter per multi-server
- **Reconnection**: Gestisci reconnection automatica lato client
- **Memory**: Monitora memoria per connessioni persistenti

