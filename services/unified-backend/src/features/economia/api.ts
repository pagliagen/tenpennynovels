// Barrel pubblico della feature. Vuoto per i consumatori esterni "core-adjacent"
// (che restano su import diretto ai path interni, marcati boundary-allow — stesso
// pattern di occupazioni), MA non può essere un barrel vuoto puro: server.ts
// importa questo modulo dinamicamente solo per innescare il side-effect del
// cron in services/serviceCancellationCleanup.ts (cron.schedule() a livello di
// modulo, nessuna funzione da chiamare esplicitamente). Se questo export venisse
// rimosso, il cron smetterebbe di registrarsi senza alcun errore visibile.
export * from './services/serviceCancellationCleanup';
