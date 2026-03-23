# Authentication Flow

## Panoramica

TenPennyNovels usa un sistema di autenticazione a due livelli:
1. **User Authentication**: Autenticazione utente con JWT
2. **Character Session**: Sessione character separata per gameplay

## Flusso Autenticazione Utente

### Registrazione
1. User compila form registrazione → `POST /auth/register`
2. Authentication Backend:
   - Valida input (username, email, password)
   - Hash password con bcrypt
   - Genera email verification token
   - Crea User in database
   - Invia email verifica
3. Risposta: User creato, email verifica inviata

### Verifica Email
1. User clicca link verifica (email contiene `/?token=xxx`) → atterra su index
2. Index legge `?token=`, rimuove da URL, chiama `GET /auth/verify-email/:token`
3. Authentication Backend:
   - Valida token
   - Aggiorna User.isEmailVerified = true
4. Risposta: Email verificata; index mostra success/error (e pulsante Reinvia se canResend)

### Login
1. User inserisce credenziali → `POST /auth/login`
2. Authentication Backend:
   - Valida username/email e password
   - Genera JWT token
   - Salva token in HttpOnly cookie
   - Crea user session in Redis
3. Risposta: Login riuscito, token in cookie

### Refresh Token
1. Frontend richiede refresh → `POST /auth/refresh`
2. Authentication Backend:
   - Valida token esistente
   - Genera nuovo JWT token
   - Aggiorna cookie
3. Risposta: Nuovo token generato

## Flusso Character Session

### Avvio sessione (selezione personaggio)
1. Utente seleziona il personaggio → **`POST /auth/select-character`** (body: `characterId`), definito in `modules/auth/routes/auth.ts`.
2. Auth module (`AuthController.selectCharacter`):
   - Verifica ownership del character e stato (es. non `DELETED`)
   - Crea/aggiorna sessione in **Redis** tramite `SessionStore.createSession` → ottiene un **`sessionId`** opaco (multi-tab)
   - Opzionale: traccia audit su MongoDB (`CharacterSessionManager` / `CharacterSession`) senza vincolo di un solo tab
3. Risposta: il client deve conservare `sessionId` (es. `sessionStorage` come `character_session_id`) e inviarlo come header **`X-Session-Id`** sulle API; per WebSocket si passa `auth: { sessionId }` lato `socket.io-client`.

### Sessione attiva
- Il middleware auth carica il contesto character dalla sessione Redis quando è presente `X-Session-Id` (flusso attuale); il cookie `character_context` resta per compatibilità ma è **deprecato** in favore della session ID.
- Le route sotto `/game` usano i middleware del **modulo game** (`modules/game/middleware/auth`), non un ipotetico `CharacterSessionMiddleware` sul modulo auth.

### Terminazione / cambio personaggio
- Non fare affidamento su un endpoint documentato come `POST /auth/character-session/end`: usare i flussi reali (`POST /auth/logout`, cambio character con nuova `select-character`, invalidazione sessioni da `SecurityController` dove esposto, ecc.). Consultare `AuthController` e `CharacterSessionManager` per il comportamento aggiornato.

## Middleware Autenticazione

### AuthMiddleware (modulo `auth` — route `/auth`)
- Verifica JWT token da cookie
- Estrae user info da token
- Aggiunge `req.user` con dati utente

### AuthMiddleware (modulo `game`)
- Autenticazione utente e permessi di gioco per le route `/game`; vedi `modules/game/middleware/auth.ts`.

### AdminAuthMiddleware (modulo `admin` / app Management)
- Verifica JWT token
- Verifica user ha ruoli admin
- Verifica permessi specifici per operazione
- Log operazioni admin

## Security

### Password Security
- Password hashate con bcrypt (10 rounds)
- Mai password in plain text
- Password reset con token temporaneo

### Token Security
- JWT tokens con scadenza (24h default)
- HttpOnly cookies (non accessibili da JavaScript)
- Secure flag in produzione (HTTPS only)
- SameSite protection contro CSRF

### Session Security
- Session ID generati casualmente
- Session storage in Redis con TTL
- Cleanup automatico sessioni scadute

## Best Practices

1. **Mai password in log** - Log solo hash o nulla
2. **Valida sempre input** - Prevenire injection
3. **Rate limiting** - Limita tentativi login
4. **Audit log** - Log operazioni sensibili
5. **Error messages** - Non rivelare informazioni sensibili

