# Chat e sessioni

**Navigazione**: [Documentazione funzionale](./README.md) → Chat e sessioni

---

## Cosa fa il sistema

La comunicazione in tempo reale passa da **Socket.IO**: chat nelle location, messaggi off-game tra giocatori, notifiche di consegna/lettura per la posta in-game, e aggiornamenti di presenza. Le **sessioni di gioco** (tavoli guidati da master) usano il backend per ordine dei turni, esiti e collegamenti alle meccaniche di skill e dadi ove previsto.

## Per il giocatore

- In location usi i tipi di messaggio consentiti (in-character, sussurri, azioni master, tiri, ecc.) secondo le regole del sito.
- Le chat private e la posta hanno flussi dedicati nell’interfaccia game.
- Durante una sessione guidata segui le indicazioni del master e gli strumenti UI per azioni e risultati.

## Dettagli tecnici

Vedi [WebSocket Events](../tecnica/backend/websocket-events.md), [WebSocket Patterns](../tecnica/frontend/websocket-patterns.md) e [Game App](../tecnica/frontend/game-app.md).
