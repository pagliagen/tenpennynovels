/**
 * Barrel pubblico della feature. Espone ChatSceneService: 2 consumer esterni
 * reali, ciascuno usa un metodo diverso — modules/game/controllers/
 * ChatController.ts chiama handleStandardMessage() fire-and-forget dopo il
 * salvataggio di ogni azione "standard"; server.ts importa questo modulo
 * dinamicamente solo per innescare il side-effect del cron in
 * services/sceneClosingCron.ts (cron.schedule() a livello di modulo,
 * nessuna funzione da chiamare esplicitamente — se questo export venisse
 * rimosso il cron smetterebbe di registrarsi senza alcun errore visibile,
 * stesso rischio già noto per economia/serviceCancellationCleanup).
 */
export { ChatSceneService } from './services/ChatSceneService';
export * from './services/sceneClosingCron';
