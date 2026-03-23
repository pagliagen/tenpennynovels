# WebSocket System

## Panoramica

TenPennyNovels usa **Socket.IO** sullo **stesso server HTTP del unified-backend** (`services/unified-backend/src/server.ts`). Il **API Gateway** espone il path **`/socket.io`** verso quel backend; i frontend (es. app **game**) usano di norma **`NEXT_PUBLIC_WS_URL`** / default **`ws://localhost:8000`**, non una porta separata tipo 3005.

## Architettura

### Server
- `http.Server` + `SocketIOServer` nello stesso processo del backend unificato.
- Adapter **Redis** (`@socket.io/redis-adapter`) per scaling orizzontale.
- Handler registrati da `modules/game/websocket` (`setupWebSocket`, `chatHandlers`, `gameHandlers`, subscriber Redis).

### Autenticazione connessione
- Middleware `io.use` in `modules/game/websocket/index.ts`: legge cookie **`auth_token`**, opzionalmente **`character_context`**; contesto personaggio da **`handshake.auth.sessionId`** + lookup **`SessionStore`** (Redis) e modello **`Character`**. Non c’è un evento client `authenticate` obbligatorio come in vecchi sketch: la pipeline è sul handshake.

### Client (app game)
- `socket.io-client` con URL gateway; `withCredentials: true`; `auth: { sessionId }` allineato a `sessionStorage` / flusso post `select-character`.

## Eventi e naming (allineati al codice)

I nomi degli eventi nel codice usano **snake_case**, non kebab-case. Esempi da `chatHandlers.ts` / `gameHandlers.ts` / `index.ts`:

- **`join_location`** / **`leave_location`** — ingresso/uscita stanza location; room tipo `location_${locationId}`.
- **`join_offgame_chats`** — join chat off-game.
- **`location_action`** — azioni/broadcast in location (emit verso room).
- **`player_entered`**, **`player_left`**, **`location_joined`**, **`location_left`**, **`offgame_chats_joined`** — conferme e presenza.
- **`typing_start`** / **`typing_stop`** — indicatori digitazione (`user_typing`).
- **`ping`** / **`pong`** — keepalive lato handler game.
- **`connected`** — emit iniziale post-connection (payload stato).
- **`user_status_change`** — presenza globale su connect/disconnect.
- **`error`** — errori strutturati con `code` / `message`.

Per l’elenco aggiornato e i payload esatti, leggere **`services/unified-backend/src/modules/game/websocket/`** e il client **`apps/game/src/contexts/WebSocketContext.tsx`** (single subscription hub).

## Room management

- Location: prefisso **`location_`** + id (es. `location_${id}`), come usato in `chatHandlers.ts`.
- Character: prefisso **`character_`** per messaggi mirati al personaggio.

## Redis

- Pub/sub per eventi di dominio (es. azioni chat) oltre all’adapter Socket.IO; dettagli in `modules/game/events/RedisSubscriber.ts` e canali usati nel codice.

## Best practices

1. **Non** copiare eventi da documentazione generica Socket.IO: verificare sempre i nomi in `websocket/*.ts`.
2. **SessionId** obbligatorio per contesto gameplay su socket quando il middleware lo richiede.
3. **Un solo** punto di sottoscrizione lato React dove possibile (`WebSocketContext`), per evitare doppie connessioni.
4. In produzione, **CORS/credentials** sono mediati dal gateway; il backend interno resta permissivo perché non esposto direttamente.
