import React, { useState } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { useOnGameMail, useOnGameMailStats, useHardDeleteOnGameMail, useSoftDeleteOnGameMail } from '@/hooks/api/useMail';
import { useNotificationStore } from '@/store/notificationStore';
import styles from '@/styles/pages/AutoModeration.module.scss';

export default function OnGameMessagesPage() {
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [messageType, setMessageType] = useState('all');
  const [status, setStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filters = {
    page,
    limit: 25,
    ...(search && { search }),
    ...(messageType !== 'all' && { messageType }),
    ...(status !== 'all' && { status }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo })
  };

  const { data, isLoading } = useOnGameMail(filters);
  const { data: stats } = useOnGameMailStats();
  const hardDeleteMutation = useHardDeleteOnGameMail();
  const softDeleteMutation = useSoftDeleteOnGameMail();

  const handleHardDelete = async (id: string) => {
    const reason = prompt('Motivazione eliminazione permanente:');
    if (!reason) return;
    try {
      await hardDeleteMutation.mutateAsync({ id, reason });
      addNotification({ type: 'success', message: 'Messaggio eliminato permanentemente' });
    } catch {
      addNotification({ type: 'error', message: 'Errore durante l\'eliminazione' });
    }
  };

  const handleSoftDelete = async (id: string) => {
    if (!confirm('Archiviare questo messaggio?')) return;
    try {
      await softDeleteMutation.mutateAsync(id);
      addNotification({ type: 'success', message: 'Messaggio archiviato' });
    } catch {
      addNotification({ type: 'error', message: 'Errore durante l\'archiviazione' });
    }
  };

  const messages = data?.data?.messages || [];
  const pagination = data?.data?.pagination;

  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | Posta OnGame</title>
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1>Posta OnGame</h1>
            <p>Tutti i messaggi del sistema postale in-game</p>
          </div>
        </header>

        {/* Stats */}
        {stats?.data && (
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.data.totalMessages}</div>
              <div className={styles.statLabel}>Totale</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.data.totalActive}</div>
              <div className={styles.statLabel}>Attivi</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.data.totalDeleted}</div>
              <div className={styles.statLabel}>Eliminati</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className={styles.filters}>
          <input
            type="text"
            placeholder="Cerca in oggetto o contenuto..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select value={messageType} onChange={(e) => { setMessageType(e.target.value); setPage(1); }}>
            <option value="all">Tutti i tipi</option>
            <option value="letter">Lettere</option>
            <option value="telegram">Telegrammi</option>
            <option value="note">Note</option>
            <option value="dispatch">Dispacci</option>
            <option value="flyer">Volantini</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">Tutti</option>
            <option value="active">Attivi</option>
            <option value="deleted">Eliminati</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        </div>

        {/* Table */}
        <div className={styles.tableWrapper}>
          {isLoading ? (
            <div className={styles.loading}>Caricamento...</div>
          ) : messages.length === 0 ? (
            <div className={styles.empty}>Nessun messaggio OnGame trovato</div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Mittente</th>
                    <th>Destinatario</th>
                    <th>Tipo</th>
                    <th>Oggetto</th>
                    <th>Anteprima</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((msg: any) => (
                    <tr key={msg._id}>
                      <td>
                        {new Date(msg.sentAt).toLocaleString('it-IT', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td>{msg.senderName}</td>
                      <td>{msg.recipientName}</td>
                      <td>{msg.messageType}</td>
                      <td><div className={styles.contentPreview} title={msg.subject}>{msg.subject}</div></td>
                      <td><div className={styles.contentPreview} title={msg.content}>{msg.content}</div></td>
                      <td>
                        <span className={`${styles.statusBadge} ${msg.isDeleted ? styles.statusDeleted : styles.statusActive}`}>
                          {msg.isDeleted ? 'Eliminato' : 'Attivo'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          {!msg.isDeleted && (
                            <>
                              <button className={`${styles.actionBtn} ${styles.dismiss}`} onClick={() => handleSoftDelete(msg._id)}>
                                Archivia
                              </button>
                              <button className={`${styles.actionBtn} ${styles.delete}`} onClick={() => handleHardDelete(msg._id)}>
                                Elimina
                              </button>
                            </>
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
                    Pagina {pagination.page} di {pagination.totalPages} ({pagination.total} totali)
                  </span>
                  <div className={styles.paginationButtons}>
                    <button onClick={() => setPage((p) => p - 1)} disabled={!pagination.hasPrevPage}>Precedente</button>
                    <button onClick={() => setPage((p) => p + 1)} disabled={!pagination.hasNextPage}>Successiva</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ManagementLayout>
  );
}
