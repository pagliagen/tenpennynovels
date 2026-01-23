# Authentication Flow

## Panoramica

TenpennyNovels usa un sistema di autenticazione a due livelli:
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
1. User clicca link verifica → `POST /auth/verify-email?token=...`
2. Authentication Backend:
   - Valida token
   - Aggiorna User.emailVerified = true
3. Risposta: Email verificata

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

### Avvio Sessione Character
1. User seleziona character → `POST /auth/character-session/start`
2. Authentication Backend:
   - Verifica character appartiene a user
   - Verifica character è approvato
   - Crea CharacterSession in database
   - Salva session ID in Redis
3. Risposta: Sessione character avviata

### Sessione Attiva
- Character session ID disponibile in `req.character.sessionId`
- Character data disponibile in `req.character`
- Usato da Game Backend per autenticazione gameplay

### Terminazione Sessione
1. User termina sessione → `POST /auth/character-session/end`
2. Authentication Backend:
   - Aggiorna CharacterSession.endTime
   - Rimuove session da Redis
3. Risposta: Sessione terminata

## Middleware Autenticazione

### AuthMiddleware (Authentication Backend)
- Verifica JWT token da cookie
- Estrae user info da token
- Aggiunge `req.user` con dati utente

### CharacterSessionMiddleware (Game Backend)
- Verifica character session attiva
- Estrae character data da session
- Aggiunge `req.character` con dati character
- Verifica character è approvato

### AdminAuthMiddleware (Management Backend)
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

