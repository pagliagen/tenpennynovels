# Autenticazione e account

**Navigazione**: [Documentazione funzionale](./README.md) → Autenticazione

---

## Cosa fa il sistema

Registrazione e accesso avvengono dalla **landing** (e flussi collegati). Dopo il login l’utente ottiene una sessione sicura; per giocare serve inoltre selezionare o creare un **personaggio** approvato, così il backend può applicare permessi e contesto di gioco corretti.

## Per il giocatore

- Crei un account con email e credenziali; dove previsto, confermi l’email prima di usare tutte le funzioni.
- Il personaggio attivo determina cosa puoi vedere in game (chat, location, foglio personaggio).
- Logout e cambio password invalidano o rinnovano le sessioni secondo le regole del sito.

## Dettagli tecnici

Vedi [Authentication](../tecnica/backend/authentication.md), [API Endpoints](../tecnica/backend/api-endpoints.md) (prefisso `/auth`) e [Error Codes](../tecnica/backend/error-codes.md) per i codici errore lato API.
