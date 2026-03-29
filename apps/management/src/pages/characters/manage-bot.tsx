import React, { useState } from 'react';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { BotDetailPanel } from '@/components/bots/BotDetailPanel';
import { useBotList, useDeleteBot } from '@/hooks/api/useBots';
import styles from '@/styles/pages/ManageBot.module.scss';

export default function ManageBotPage() {
  const { data: bots, isLoading, error } = useBotList();
  const deleteBot = useDeleteBot();
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);

  // Bot legacy (senza campo status) sono trattati come active
  const activeBots = (bots || []).filter((b: any) => (b.status || 'active') === 'active');
  const pendingBots = (bots || []).filter((b: any) => b.status === 'pending');

  const handleDelete = async (e: React.MouseEvent, botId: string) => {
    e.stopPropagation();
    if (!confirm('Eliminare questo bot?')) return;
    await deleteBot.mutateAsync(botId);
  };

  return (
    <ManagementLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1>Gestione Bot</h1>
            <p>Stato, relazioni, memorie e configurazione dei bot AI</p>
          </div>
        </div>

        {isLoading && <div className={styles.loading}>Caricamento bot...</div>}

        {error && (
          <div className={styles.error}>
            Impossibile caricare i bot. Verifica che il servizio Local-AI sia attivo.
          </div>
        )}

        {/* Pending bots */}
        {pendingBots.length > 0 && (
          <>
            <div className={styles.sectionTitle} style={{ color: '#c9a030', padding: '0 4px' }}>
              In attesa di completamento ({pendingBots.length})
            </div>
            <div className={styles.botGrid}>
              {pendingBots.map((bot: any) => {
                const botId = bot._id || bot.id;
                return (
                  <div key={botId} className={`${styles.botCard} ${styles.pending}`}>
                    <div className={styles.botCardHeader}>
                      <h3 className={styles.botName}>{bot.name}</h3>
                      <span className={styles.statusPending}>Pending</span>
                    </div>
                    <div className={styles.botMeta}>
                      <span>{bot.gender === 'male' ? 'Maschio' : bot.gender === 'female' ? 'Femmina' : '—'}</span>
                      <span>Creato: {new Date(bot.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div className={styles.pendingActions}>
                      <button className={styles.deleteBtn} onClick={(e) => handleDelete(e, botId)} disabled={deleteBot.isPending}>
                        Elimina
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Active bots */}
        {activeBots.length > 0 && (
          <>
            {pendingBots.length > 0 && (
              <div className={styles.sectionTitle} style={{ padding: '0 4px' }}>
                Bot attivi ({activeBots.length})
              </div>
            )}
            <div className={styles.botGrid}>
              {activeBots.map((bot: any) => {
                const botId = bot._id || bot.id;
                return (
                  <div
                    key={botId}
                    className={`${styles.botCard} ${selectedBotId === botId ? styles.active : ''}`}
                    onClick={() => setSelectedBotId(botId)}
                  >
                    <div className={styles.botCardHeader}>
                      <h3 className={styles.botName}>{bot.name}</h3>
                      <span className={`${styles.botMood} ${styles[bot.currentMood?.type || 'neutro']}`}>
                        {bot.currentMood?.type || 'neutro'}
                      </span>
                    </div>
                    <div className={styles.botMeta}>
                      <span>{bot.gender === 'male' ? 'Maschio' : 'Femmina'}</span>
                      {bot.character?.location && (
                        <span>Location: {bot.character.location.name}</span>
                      )}
                      {bot.activeEmotions?.length > 0 && (
                        <span>Emozioni: {bot.activeEmotions.map((e: any) => e.emotion).join(', ')}</span>
                      )}
                      <span>
                        Aggiornato: {new Date(bot.updatedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <div className={styles.pendingActions}>
                      <button className={styles.deleteBtn} onClick={(e) => handleDelete(e, botId)} disabled={deleteBot.isPending}>
                        Elimina
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {bots && activeBots.length === 0 && pendingBots.length === 0 && (
          <div className={styles.empty}>Nessun bot</div>
        )}

        {selectedBotId && (
          <BotDetailPanel
            localAiBotId={selectedBotId}
            onClose={() => setSelectedBotId(null)}
          />
        )}
      </div>
    </ManagementLayout>
  );
}
