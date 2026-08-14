import type { FeatureManifest } from '@core/features/types';
import gameRoutes from './routes/game';

/**
 * Segmentazione della chat "standard" di una location in scene narrative:
 * apertura/chiusura automatica (60' di silenzio o cambio narrativamente
 * indipendente rilevato via IA), fork in copie personali per personaggio
 * con titolo/riassunto generati via AI.
 *
 * Niente flag manifest: il cron di chiusura è gestito da
 * `appConfig.features.sceneClosing`, un flag statico letto da config/runtime
 * (non il meccanismo SystemConfiguration/Redis usato da FeatureManifest.flag)
 * — due meccanismi distinti, non unificati in questa fase. Il gate resta in
 * server.ts, invariato.
 *
 * dependsOn: ['documenti'] — ChatSceneService.ts usa EmbeddingService da
 * @features/documenti/api per summarizeScene/classifySceneContinuation, i
 * due metodi che il manifest di documenti (Fase 6.5) documenta come
 * "100% chat-only... parcheggiati lì come debito dichiarato" in attesa di
 * un core/ai/AiGatewayClient.ts che non esiste ancora: fineSessione è il
 * consumer reale che li usa.
 *
 * Il cron `sceneClosing` si è spostato dentro la feature (services/
 * sceneClosingCron.ts, prima file a sé in src/cron/) — stesso schema già
 * usato per economia/serviceCancellationCleanup in Fase 6.3: api.ts lo
 * ri-esporta per il side-effect, server.ts lo importa dinamicamente da lì
 * invece che da ./cron/sceneClosing.
 *
 * routes[].path lato game è '/' (il router interno ha già path assoluti
 * `/characters/:characterId/chat-scenes...`), stesso schema di
 * oggetti/game-inventory.ts.
 */
export const fineSessione: FeatureManifest = {
  key: 'fineSessione',
  title: 'Fine sessione',
  description: 'Segmentazione della chat in scene narrative, chiusura automatica, copie personali con titolo/riassunto',
  dependsOn: ['documenti'],
  routes: [
    { scope: 'game', path: '/', router: gameRoutes },
  ],
};
