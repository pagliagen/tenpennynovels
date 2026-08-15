import type { FeatureManifest } from '@core/features/types';
import gameRoutes from './routes/game';

/**
 * Segmentazione della chat "standard" di una location in scene narrative:
 * apertura/chiusura automatica (60' di silenzio o cambio narrativamente
 * indipendente rilevato via IA), fork in copie personali per personaggio
 * con titolo/riassunto generati via AI.
 *
 * Niente flag manifest sulla feature base: il cron di chiusura per timeout
 * è gestito da `appConfig.features.sceneClosing`, un flag statico letto da
 * config/runtime (non il meccanismo SystemConfiguration/Redis usato da
 * FeatureManifest.flag) — deve girare sempre, non è disattivabile a runtime.
 * Il gate resta in server.ts, invariato.
 *
 * La sola componente AI (classificazione continua/indipendente in
 * ChatSceneService.classifyContinuation, chiamata da handleStandardMessage)
 * è invece disattivabile: vedi il manifest `fineSessioneAi` sotto, flag
 * separato risolto tramite FeatureFlagService (stesso meccanismo di
 * `bibliotecario`). Se spenta, un personaggio nuovo chiude sempre subito la
 * scena aperta — lo stesso comportamento già usato oggi in caso di
 * errore/timeout della classificazione (vedi il catch in
 * classifyContinuation): nessun branch nuovo, solo lo stesso fallback
 * raggiunto per una via diversa.
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

/**
 * Manifest solo-flag, niente routes/extensions: esiste unicamente per dare
 * a FeatureFlagService una entry risolvibile per la classificazione AI di
 * ChatSceneService (chiamata diretta, non un extension point — la feature
 * `fineSessione` non passa da ExtensionRegistry). Stesso pattern di
 * `bibliotecario`, chiave e configKey distinti dalla feature base apposta
 * perché non deve gatare le route di fineSessione né il cron.
 */
export const fineSessioneAi: FeatureManifest = {
  key: 'fineSessioneAi',
  title: 'Fine sessione — classificazione AI',
  description: 'Classificazione AI (continua/indipendente) di un nuovo personaggio in una scena già aperta',
  flag: {
    configKey: 'scene_narrative_ai_enabled',
    section: 'ai_features',
    default: true,
    label: 'Fine sessione: classificazione AI continuità narrativa',
  },
};
