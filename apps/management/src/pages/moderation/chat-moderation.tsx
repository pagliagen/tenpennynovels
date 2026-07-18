import React, { useState, useCallback } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { useAutoModerationAlerts, useAutoModerationStats, useReviewAlert } from '@/hooks/api/useAutoModeration';
import { useNotificationStore } from '@/store/notificationStore';
import { API_CONFIG } from '@/constants/config';
import type { ModerationAlertRecord } from '@/lib/api/moderation';
import styles from '@/styles/pages/AutoModeration.module.scss';

function ScoreDisplay({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const cls = score >= 0.85 ? styles.scoreHigh : score >= 0.7 ? styles.scoreMedium : styles.scoreLow;
  const bg = score >= 0.85 ? '#e74c3c' : score >= 0.7 ? '#f39c12' : '#27ae60';

  return (
    <div className={styles.scoreBar}>
      <div className={styles.scoreFill}>
        <div
          className={styles.scoreFillInner}
          style={{ '--score-pct': `${pct}%`, '--score-bg': bg } as React.CSSProperties}
        />
      </div>
      <span className={`${styles.scoreText} ${cls}`}>{pct}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: styles.statusPending,
    reviewed: styles.statusReviewed,
    dismissed: styles.statusDismissed,
    actioned: styles.statusActioned,
  };
  const labels: Record<string, string> = {
    pending: 'In attesa',
    reviewed: 'Revisionato',
    dismissed: 'Archiviato',
    actioned: 'Sanzionato',
  };
  return <span className={`${styles.statusBadge} ${map[status] || ''}`}>{labels[status] || status}</span>;
}

export default function ChatModerationPage() {
  const addNotification = useNotificationStore((s) => s.addNotification);

  const copyLocationUrl = useCallback((locationSlug?: string) => {
    if (!locationSlug) {
      addNotification({ type: 'error', message: 'Slug location non disponibile' });
      return;
    }
    const url = `${API_CONFIG.GAME_URL}/locations/${locationSlug}/chat`;
    navigator.clipboard.writeText(url).then(
      () => addNotification({ type: 'success', message: 'URL copiato negli appunti' }),
      () => addNotification({ type: 'error', message: 'Impossibile copiare l\'URL' })
    );
  }, [addNotification]);

  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<'chat' | 'forum' | 'ongame_message' | 'offgame_message'>('chat');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [minScore, setMinScore] = useState<string>('');
  const [reviewingAlert, setReviewingAlert] = useState<ModerationAlertRecord | null>(null);
  const [reviewStatus, setReviewStatus] = useState('reviewed');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState('');

  const filters = {
    page,
    limit: 20,
    source: sourceFilter,
    ...(statusFilter && { status: statusFilter }),
    ...(minScore && { minScore: parseFloat(minScore) }),
  };

  const { data, isLoading, error } = useAutoModerationAlerts(filters);
  const { data: stats } = useAutoModerationStats(sourceFilter);
  const reviewMutation = useReviewAlert();

  const openReview = (alert: ModerationAlertRecord) => {
    setReviewingAlert(alert);
    setReviewStatus('reviewed');
    setReviewNotes('');
    setReviewAction('');
  };

  const handleReview = () => {
    if (!reviewingAlert) return;
    reviewMutation.mutate(
      { id: reviewingAlert._id, status: reviewStatus, reviewNotes: reviewNotes || undefined, actionTaken: reviewAction || undefined },
      {
        onSuccess: () => {
          addNotification({ type: 'success', message: 'Alert aggiornato' });
          setReviewingAlert(null);
        },
        onError: (err: Error) => {
          addNotification({ type: 'error', message: err.message || 'Errore' });
        },
      }
    );
  };

  const quickDismiss = (alert: ModerationAlertRecord) => {
    reviewMutation.mutate(
      { id: alert._id, status: 'dismissed' },
      {
        onSuccess: () => addNotification({ type: 'success', message: 'Alert archiviato' }),
        onError: (err: Error) => addNotification({ type: 'error', message: err.message }),
      }
    );
  };

  if (isLoading) {
    return <ManagementLayout><div className={styles.loading}>Caricamento alert...</div></ManagementLayout>;
  }

  if (error) {
    return (
      <ManagementLayout>
        <div className={styles.error}>
          <h2>Errore</h2>
          <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
        </div>
      </ManagementLayout>
    );
  }

  const alerts = data?.list || [];
  const pagination = data?.pagination;

  const sourceLabels: Record<string, string> = {
    chat: 'Chat',
    forum: 'Forum',
    ongame_message: 'Mail OnGame',
    offgame_message: 'Mail OffGame',
  };

  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | Moderazione AI</title>
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1>Moderazione AI</h1>
            <p>Contenuti flaggati automaticamente dal sistema di moderazione AI</p>
          </div>
        </header>

        {stats && (
          <div className={styles.statsRow}>
            <div className={`${styles.statCard} ${styles.pending}`}>
              <div className={styles.statValue}>{stats.pending}</div>
              <div className={styles.statLabel}>In attesa</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.reviewed}</div>
              <div className={styles.statLabel}>Revisionati</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.dismissed}</div>
              <div className={styles.statLabel}>Archiviati</div>
            </div>
            <div className={`${styles.statCard} ${styles.actioned}`}>
              <div className={styles.statValue}>{stats.actioned}</div>
              <div className={styles.statLabel}>Sanzionati</div>
            </div>
          </div>
        )}

        <div className={styles.filters}>
          <label>
            Tipo
            <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value as any); setPage(1); }}>
              <option value="chat">Chat</option>
              <option value="forum">Forum</option>
              <option value="ongame_message">Mail OnGame</option>
              <option value="offgame_message">Mail OffGame</option>
            </select>
          </label>
          <label>
            Stato
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">Tutti</option>
              <option value="pending">In attesa</option>
              <option value="reviewed">Revisionati</option>
              <option value="dismissed">Archiviati</option>
              <option value="actioned">Sanzionati</option>
            </select>
          </label>
          <label>
            Score minimo
            <input type="number" min="0" max="1" step="0.05" value={minScore} onChange={(e) => { setMinScore(e.target.value); setPage(1); }} placeholder="0.7" />
          </label>
        </div>

        <div className={styles.tableWrapper}>
          {alerts.length === 0 ? (
            <div className={styles.empty}>Nessun alert di moderazione chat trovato</div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data</th>
                    {(sourceFilter === 'ongame_message' || sourceFilter === 'offgame_message') ? (
                      <>
                        <th>Mittente</th>
                        {sourceFilter === 'ongame_message' && <th>Destinatario</th>}
                        {sourceFilter === 'ongame_message' && <th>Oggetto</th>}
                      </>
                    ) : (
                      <>
                        <th>Personaggio</th>
                        <th>Location</th>
                      </>
                    )}
                    <th>Score</th>
                    <th>Anteprima</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr key={alert._id}>
                      <td>{new Date(alert.createdAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      {(sourceFilter === 'ongame_message' || sourceFilter === 'offgame_message') ? (
                        <>
                          <td>{alert.mailSenderName || alert.characterName}</td>
                          {sourceFilter === 'ongame_message' && <td>{alert.mailRecipientName || '-'}</td>}
                          {sourceFilter === 'ongame_message' && <td><div className={styles.contentPreview} title={alert.mailSubject}>{alert.mailSubject}</div></td>}
                        </>
                      ) : (
                        <>
                          <td>{alert.characterName}</td>
                          <td>
                            <button
                              className={styles.locationLink}
                              onClick={() => copyLocationUrl(alert.locationSlug)}
                              title="Copia URL location"
                            >
                              {alert.locationName || alert.locationId}
                            </button>
                          </td>
                        </>
                      )}
                      <td><ScoreDisplay score={alert.toxicityScore} /></td>
                      <td><div className={styles.contentPreview} title={alert.content}>{alert.content}</div></td>
                      <td><StatusBadge status={alert.status} /></td>
                      <td>
                        <div className={styles.actions}>
                          {alert.status === 'pending' && (
                            <>
                              <button className={`${styles.actionBtn} ${styles.review}`} onClick={() => openReview(alert)}>Revisiona</button>
                              <button className={`${styles.actionBtn} ${styles.dismiss}`} onClick={() => quickDismiss(alert)}>Archivia</button>
                            </>
                          )}
                          {alert.status !== 'pending' && (
                            <button className={styles.actionBtn} onClick={() => openReview(alert)}>Dettaglio</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {pagination && (
                <div className={styles.pagination}>
                  <span className={styles.paginationInfo}>
                    Pagina {pagination.page} di {pagination.totalPages} ({pagination.totalItems} totali)
                  </span>
                  <div className={styles.paginationButtons}>
                    <button onClick={() => setPage(p => p - 1)} disabled={!pagination.hasPrevPage}>Precedente</button>
                    <button onClick={() => setPage(p => p + 1)} disabled={!pagination.hasNextPage}>Successiva</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {reviewingAlert && (
        <div className={styles.modal} onClick={() => setReviewingAlert(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Revisione Alert {sourceLabels[reviewingAlert.source] || reviewingAlert.source}</h3>

            {(reviewingAlert.source === 'ongame_message' || reviewingAlert.source === 'offgame_message') ? (
              <>
                <div className={styles.modalField}>
                  <label>Mittente</label>
                  <div className={styles.modalValue}>{reviewingAlert.mailSenderName || reviewingAlert.characterName}</div>
                </div>

                {reviewingAlert.source === 'ongame_message' && (
                  <>
                    <div className={styles.modalField}>
                      <label>Destinatario</label>
                      <div className={styles.modalValue}>{reviewingAlert.mailRecipientName || '-'}</div>
                    </div>

                    <div className={styles.modalField}>
                      <label>Oggetto</label>
                      <div className={styles.modalValue}>{reviewingAlert.mailSubject || '-'}</div>
                    </div>
                  </>
                )}

                <div className={styles.modalField}>
                  <label>Thread ID</label>
                  <div className={styles.modalValue}>
                    {reviewingAlert.source === 'ongame_message'
                      ? reviewingAlert.onGameThreadId
                      : reviewingAlert.offGameThreadId}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.modalField}>
                  <label>Personaggio</label>
                  <div className={styles.modalValue}>{reviewingAlert.characterName}</div>
                </div>

                <div className={styles.modalField}>
                  <label>Location</label>
                  <div className={styles.modalValue}>
                    <button
                      className={styles.locationLink}
                      onClick={() => copyLocationUrl(reviewingAlert.locationSlug)}
                      title="Copia URL location"
                    >
                      {reviewingAlert.locationName || reviewingAlert.locationId}
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className={styles.modalField}>
              <label>Score tossicita</label>
              <div className={styles.modalValue}><ScoreDisplay score={reviewingAlert.toxicityScore} /></div>
            </div>

            <div className={styles.modalField}>
              <label>Contenuto flaggato</label>
              <div className={styles.modalValuePreWrap}>{reviewingAlert.content}</div>
            </div>

            <div className={styles.modalField}>
              <label>Data</label>
              <div className={styles.modalValue}>{new Date(reviewingAlert.createdAt).toLocaleString('it-IT')}</div>
            </div>

            {reviewingAlert.status === 'pending' ? (
              <>
                <div className={styles.modalField}>
                  <label>Esito revisione</label>
                  <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                    <option value="reviewed">Revisionato (nessuna azione)</option>
                    <option value="dismissed">Archivia (falso positivo)</option>
                    <option value="actioned">Sanziona</option>
                  </select>
                </div>

                {reviewStatus === 'actioned' && (
                  <div className={styles.modalField}>
                    <label>Azione</label>
                    <select value={reviewAction} onChange={(e) => setReviewAction(e.target.value)}>
                      <option value="">Seleziona...</option>
                      <option value="warning">Avvertimento</option>
                      <option value="message_hidden">Nascondi messaggio</option>
                      <option value="message_deleted">Elimina messaggio</option>
                    </select>
                  </div>
                )}

                <div className={styles.modalField}>
                  <label>Note (opzionale)</label>
                  <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Note sulla revisione..." />
                </div>

                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={() => setReviewingAlert(null)}>Annulla</button>
                  <button className={styles.confirmBtn} onClick={handleReview} disabled={reviewMutation.isPending}>
                    {reviewMutation.isPending ? 'Salvataggio...' : 'Conferma'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {reviewingAlert.reviewNotes && (
                  <div className={styles.modalField}>
                    <label>Note revisione</label>
                    <div className={styles.modalValue}>{reviewingAlert.reviewNotes}</div>
                  </div>
                )}
                {reviewingAlert.actionTaken && (
                  <div className={styles.modalField}>
                    <label>Azione intrapresa</label>
                    <div className={styles.modalValue}>{reviewingAlert.actionTaken}</div>
                  </div>
                )}
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={() => setReviewingAlert(null)}>Chiudi</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </ManagementLayout>
  );
}
