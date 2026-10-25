import type { FeatureManifest } from '@core/features/types';
import adminRoutes from './routes/admin';

/**
 * Il tab «Bot» del gestionale: elenco dei bot e generazione di nuovi (personaggio + scheda + location).
 *
 * È uno STRUMENTO DA SVILUPPO. Le schede vivono in file sul computer dove gira `bot-service` e il bot parla solo con
 * Redis/Mongo/backend locali: in produzione il bot è spento per scelta e la feature non c'è. Attiva solo se
 * `ENABLE_BOT_CHARACTERS=true` **e** il gateway AI dichiara attivo e sano il servizio `character-bot` (stessa logica di
 * `editorialAi`, ma variabile separata: `ENABLE_IA_EDITORIAL` resta `true` in produzione, questa no).
 * Con la variabile spenta il gateway non viene nemmeno interrogato e le route rispondono 404.
 *
 * dependsOn: ['editorial'] — `findAnachronisms` per controllare il testo scritto dal modello (`editorial/api.ts`).
 */
export const botAdmin: FeatureManifest = {
  key: 'botAdmin',
  title: 'Bot personaggio (gestionale)',
  description: 'Elenco e generazione dei bot dal gestionale (solo ambienti con ENABLE_BOT_CHARACTERS=true)',
  dependsOn: ['editorial'],
  flag: { source: 'env', envVar: 'ENABLE_BOT_CHARACTERS', label: 'Bot personaggio (ENABLE_BOT_CHARACTERS)', requiresAiService: 'character-bot' },
  routes: [{ scope: 'admin', path: '/bots', router: adminRoutes }],
};
