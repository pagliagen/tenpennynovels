import type { FeatureManifest } from '@core/features/types';
import adminRoutes from './routes/admin';

/**
 * Il tab «Bot» del gestionale: elenco dei bot e generazione di nuovi (personaggio + scheda + location).
 *
 * Le schede vivono in file sul computer dove gira `bot-service`. Ogni bot appartiene a un **ambiente** (`appConfig.botEnvironment`):
 * il suo personaggio esiste solo nel database di quell'ambiente, e le location hanno gli stessi id ovunque, quindi è
 * l'etichetta (non la location) a dire di chi è un bot. Attivare la feature non accende il bot di chat (`BOT_SERVICE_SECRET`).
 * Attiva solo se `ENABLE_BOT_CHARACTERS=true` **e** il gateway AI dichiara attivo e sano il servizio `character-bot` (stessa
 * logica di `editorialAi`, ma variabile separata). Con la variabile spenta il gateway non viene nemmeno interrogato e le
 * route rispondono 404.
 *
 * dependsOn: ['editorial'] — `findAnachronisms` per controllare il testo scritto dal modello (`editorial/api.ts`).
 * dependsOn: ['botChat'] — dopo la creazione di un bot l'elenco delle location con bot si rilegge subito (`botChat/api.ts`).
 */
export const botAdmin: FeatureManifest = {
  key: 'botAdmin',
  title: 'Bot personaggio (gestionale)',
  description: 'Elenco e generazione dei bot dal gestionale (solo ambienti con ENABLE_BOT_CHARACTERS=true)',
  dependsOn: ['editorial', 'botChat'],
  flag: { source: 'env', envVar: 'ENABLE_BOT_CHARACTERS', label: 'Bot personaggio (ENABLE_BOT_CHARACTERS)', requiresAiService: 'character-bot' },
  routes: [{ scope: 'admin', path: '/bots', router: adminRoutes }],
};
