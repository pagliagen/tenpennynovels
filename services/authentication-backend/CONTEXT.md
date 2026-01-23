# Authentication Backend Context

## Scopo
Gestisce autenticazione utenti, registrazione, login, gestione sessioni, verifica email, reset password e gestione character sessions.

## Architettura
- **Controllers**: Gestiscono richieste HTTP per autenticazione
- **Routes**: Definiscono endpoint REST con prefisso `/auth`
- **Middleware**: `AuthMiddleware` per proteggere route, `RateLimitMiddleware` per rate limiting
- **Services**: EmailService per invio email, CharacterSessionManager per gestione sessioni
- **Utils**: CryptoUtils per hashing password, gestione token

## Pattern Comuni

### API Response Format
Tutti i controller usano formato API standardizzato:
```typescript
{
  result: boolean,
  data?: T,
  error?: string,
  code?: string,
  timestamp: string
}
```

### Autenticazione
- JWT-based authentication con HttpOnly cookies
- Token refresh mechanism
- Character session management separato da user session

### Security
- Password hashing con bcrypt
- Email verification tokens
- Password reset tokens con scadenza
- Rate limiting su endpoint sensibili

### Session Management
- User sessions: gestite via JWT
- Character sessions: gestite separatamente per gameplay
- Redis per storage sessioni attive

## Dipendenze

### Database
- `services/database/models` - Modelli User e Character
- Accesso diretto ai modelli Mongoose

### Shared Code
- `services/shared` - Utility condivise
- `services/shared/types` - Tipi TypeScript condivisi

### External Services
- **Redis**: Storage sessioni e cache
- **MongoDB**: Database principale
- **Email Service**: Invio email (verifica, reset password)

## Endpoint Principali

### Registration & Login
- `POST /auth/register` - Registra nuovo utente
- `POST /auth/login` - Login utente
- `POST /auth/logout` - Logout utente
- `POST /auth/refresh` - Refresh JWT token

### Email Verification
- `POST /auth/verify-email` - Verifica email con token
- `POST /auth/resend-verification` - Reinvia email verifica

### Password Management
- `POST /auth/forgot-password` - Richiedi reset password
- `POST /auth/reset-password` - Reset password con token

### Character Sessions
- `POST /auth/character-session/start` - Avvia sessione character
- `POST /auth/character-session/end` - Termina sessione character
- `GET /auth/character-session/active` - Sessione character attiva

## Come Aggiungere Nuovo Endpoint Auth

1. Crea controller method in `src/controllers/[Name]Controller.ts`
2. Usa helper da `utils/apiResponse.ts` per risposte
3. Applica middleware appropriato (AuthMiddleware, RateLimitMiddleware)
4. Usa CryptoUtils per operazioni crittografiche
5. Aggiungi route in `src/routes/[name]Routes.ts`
6. Registra route in `src/routes/index.ts` con prefisso `/auth`

## Note Importanti

- **Security**: Sempre hash password, mai in plain text
- **Tokens**: Genera token sicuri con scadenza
- **Rate Limiting**: Applica rate limiting su endpoint pubblici
- **Email**: Valida sempre email e gestisci errori invio
- **Sessions**: Gestisci correttamente scadenza e cleanup sessioni

