# Locations e mappa

**Navigazione**: [Documentazione funzionale](./README.md) → Locations

---

## Cosa fa il sistema

Il mondo è organizzato in **location** gerarchiche (quartieri, edifici, stanze). Entrando in una location il personaggio vede chi c’è, partecipa alla **chat di scena** e rispetta le regole di visibilità definite per quel luogo (pubblico, privato, shop, ecc.).

## Per il giocatore

- Ti muovi tra le location dall’interfaccia mappa o elenco previsti dall’app game.
- La presenza è aggiornata in tempo reale: quando entri o esci, gli altri giocatori nella stessa location possono vederlo.
- Alcune location possono essere riservate a ruoli, corporazioni o condizioni narrative.

## Dettagli tecnici

Vedi [WebSocket Events](../tecnica/backend/websocket-events.md) (join/leave, presenza, messaggi) e [Game App](../tecnica/frontend/game-app.md).
