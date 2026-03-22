# Pannello di gestione (staff)

**Navigazione**: [Documentazione funzionale](./README.md) → Gestione admin

---

## Cosa fa il sistema

L’app **management** è riservata a ruoli staff: approvazione personaggi, moderazione, configurazione contenuti (documenti, location, oggetti, occupazioni, ecc.), ticket di supporto e strumenti di analisi. Tutte le azioni sensibili passano dal **unified-backend** dietro API Gateway, con permessi granulari.

## Per lo staff

- Usi account con privilegi elevati; ogni sezione rispetta i permessi del tuo ruolo.
- Le modifiche ai dati di gioco impattano immediatamente o dopo i flussi di cache/embedding previsti (es. documenti indicizzati).

## Dettagli tecnici

Vedi [Management App](../tecnica/frontend/management-app.md), [Unified Backend](../tecnica/backend/unified-backend.md) (modulo `admin`), [API Endpoints](../tecnica/backend/api-endpoints.md) e [Authentication](../tecnica/backend/authentication.md).
