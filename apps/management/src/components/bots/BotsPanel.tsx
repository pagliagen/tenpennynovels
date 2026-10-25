/**
 * BotsPanel - il tab «Bot» della lista personaggi (strumento da sviluppo).
 *
 * Elenco dei bot (da `bot-service`, arricchito con location e stato del personaggio) e «Genera bot».
 * Si monta solo se `featureFlagsStore.botAdminEnabled`: ENABLE_BOT_CHARACTERS e servizio `character-bot` raggiungibile.
 */

import React, { useState } from 'react';
import { GenerateBotModal } from '@/components/bots/GenerateBotModal';
import { useBots } from '@/hooks/api/useBots';
import styles from '@/styles/components/BotsPanel.module.scss';

export function BotsPanel(): React.ReactElement {
  const { data: bots, isLoading, error, refetch } = useBots();
  const [generating, setGenerating] = useState(false);

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.primaryBtn} onClick={() => setGenerating(true)}>✨ Genera bot</button>
        <p className={styles.note}>
          I bot rispondono nella chat di una location. Le schede stanno nei file di <code>bot-service</code> di questo computer:
          strumento da sviluppo, non esiste in produzione.
        </p>
      </div>

      {isLoading && <p className={styles.note}>Carico i bot…</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error instanceof Error ? error.message : 'Il servizio dei bot non risponde'}{' '}
          <button type="button" className={styles.linkBtn} onClick={() => void refetch()}>Riprova</button>
        </p>
      )}

      {bots && bots.length === 0 && <p className={styles.note}>Nessun bot ancora. «Genera bot» ne crea uno per una location.</p>}

      {bots && bots.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr><th>Nome</th><th>Location</th><th>Personaggio</th><th>Servizio</th></tr>
          </thead>
          <tbody>
            {bots.map((bot) => (
              <tr key={bot.characterId}>
                <td>{bot.name}</td>
                <td>{bot.locationName ?? (bot.locationId ? 'Location non trovata' : 'Non assegnato')}</td>
                <td>{bot.playerStatus ?? 'Non trovato'}</td>
                <td className={bot.active ? styles.ok : styles.warn}>{bot.active ? 'Attivo' : 'Non caricato (riavvia bot-service)'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {generating && <GenerateBotModal existingBots={bots ?? []} onClose={() => setGenerating(false)} />}
    </div>
  );
}
