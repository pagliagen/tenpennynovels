import React, { useState } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { useOnGameMail, useOnGameMailStats, useHardDeleteOnGameMail, useSoftDeleteOnGameMail, useBulkDeleteOnGameMail } from '@/hooks/api/useMail';
import { useOffGameMail, useOffGameMailStats, useHardDeleteOffGameMail, useSoftDeleteOffGameMail, useBulkDeleteOffGameMail } from '@/hooks/api/useMail';
import { useNotificationStore } from '@/store/notificationStore';
import styles from '@/styles/pages/AutoModeration.module.scss';

interface OnGameMailFilters {
  page: number;
  limit: number;
  search?: string;
  messageType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface OffGameMailFilters {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export default function MailModerationPage() {
  const [activeTab, setActiveTab] = useState<'ongame' | 'offgame'>('ongame');

  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | Moderazione Mail</title>
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1>Moderazione Mail</h1>
            <p>Gestione messaggi OnGame e OffGame</p>
          </div>
        </header>

        <div className={styles.tabs}>
          <button
            className={activeTab === 'ongame' ? styles.active : ''}
            onClick={() => setActiveTab('ongame')}
          >
            OnGame Mail
          </button>
          <button
            className={activeTab === 'offgame' ? styles.active : ''}
            onClick={() => setActiveTab('offgame')}
          >
            OffGame Mail
          </button>
        </div>

        {activeTab === 'ongame' ? <OnGameMailModeration /> : <OffGameMailModeration />}
      </div>
    </ManagementLayout>
  );
}

function OnGameMailModeration() {
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [messageType, setMessageType] = useState('all');
  const [status, setStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filters: OnGameMailFilters = {
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
    } catch (error) {
      addNotification({ type: 'error', message: 'Errore durante l\'eliminazione' });
    }
  };

  const handleSoftDelete = async (id: string) => {
    if (!confirm('Archiviare questo messaggio?')) return;

    try {
      await softDeleteMutation.mutateAsync(id);
      addNotification({ type: 'success', message: 'Messaggio archiviato' });
    } catch (error) {
      addNotification({ type: 'error', message: 'Errore durante l\'archiviazione' });
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Caricamento messaggi OnGame...</div>;
  }

  const messages = data?.data?.messages || [];
  const pagination = data?.data?.pagination;

  return (
    <div className={styles.moderationSection}>
      {/* Stats Dashboard */}
      {stats && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.data.totalMessages}</div>
            <div className={styles.statLabel}>Totale Messaggi</div>
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
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={messageType}
          onChange={(e) => {
            setMessageType(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Tutti i tipi</option>
          <option value="letter">Lettere</option>
          <option value="telegram">Telegrammi</option>
          <option value="note">Note</option>
          <option value="dispatch">Dispacci</option>
          <option value="flyer">Volantini</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Tutti</option>
          <option value="active">Attivi</option>
          <option value="deleted">Eliminati</option>
        </select>
        <input
          type="date"
          placeholder="Data da"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          type="date"
          placeholder="Data a"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        {messages.length === 0 ? (
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
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td>{msg.senderName}</td>
                    <td>{msg.recipientName}</td>
                    <td>{msg.messageType}</td>
                    <td>
                      <div className={styles.contentPreview} title={msg.subject}>
                        {msg.subject}
                      </div>
                    </td>
                    <td>
                      <div className={styles.contentPreview} title={msg.content}>
                        {msg.content}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          msg.isDeleted ? styles.statusDeleted : styles.statusActive
                        }`}
                      >
                        {msg.isDeleted ? 'Eliminato' : 'Attivo'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {!msg.isDeleted && (
                          <>
                            <button
                              className={`${styles.actionBtn} ${styles.dismiss}`}
                              onClick={() => handleSoftDelete(msg._id)}
                            >
                              Archivia
                            </button>
                            <button
                              className={`${styles.actionBtn} ${styles.delete}`}
                              onClick={() => handleHardDelete(msg._id)}
                            >
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
                  <button onClick={() => setPage((p) => p - 1)} disabled={!pagination.hasPrevPage}>
                    Precedente
                  </button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={!pagination.hasNextPage}>
                    Successiva
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function OffGameMailModeration() {
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filters: OffGameMailFilters = {
    page,
    limit: 25,
    ...(search && { search }),
    ...(status !== 'all' && { status }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo })
  };

  const { data, isLoading } = useOffGameMail(filters);
  const { data: stats } = useOffGameMailStats();
  const hardDeleteMutation = useHardDeleteOffGameMail();
  const softDeleteMutation = useSoftDeleteOffGameMail();

  const handleHardDelete = async (id: string) => {
    const reason = prompt('Motivazione eliminazione permanente:');
    if (!reason) return;

    try {
      await hardDeleteMutation.mutateAsync({ id, reason });
      addNotification({ type: 'success', message: 'Messaggio eliminato permanentemente' });
    } catch (error) {
      addNotification({ type: 'error', message: 'Errore durante l\'eliminazione' });
    }
  };

  const handleSoftDelete = async (id: string) => {
    if (!confirm('Archiviare questo messaggio?')) return;

    try {
      await softDeleteMutation.mutateAsync(id);
      addNotification({ type: 'success', message: 'Messaggio archiviato' });
    } catch (error) {
      addNotification({ type: 'error', message: 'Errore durante l\'archiviazione' });
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Caricamento messaggi OffGame...</div>;
  }

  const messages = data?.data?.messages || [];
  const pagination = data?.data?.pagination;

  return (
    <div className={styles.moderationSection}>
      {/* Stats Dashboard */}
      {stats && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.data.totalMessages}</div>
            <div className={styles.statLabel}>Totale Messaggi</div>
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
          placeholder="Cerca nel contenuto..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Tutti</option>
          <option value="active">Attivi</option>
          <option value="deleted">Eliminati</option>
        </select>
        <input
          type="date"
          placeholder="Data da"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          type="date"
          placeholder="Data a"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        {messages.length === 0 ? (
          <div className={styles.empty}>Nessun messaggio OffGame trovato</div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Mittente</th>
                  <th>Anteprima</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg: any) => (
                  <tr key={msg._id}>
                    <td>
                      {new Date(msg.createdAt).toLocaleString('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td>{msg.senderName}</td>
                    <td>
                      <div className={styles.contentPreview} title={msg.content}>
                        {msg.content}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          msg.isDeleted ? styles.statusDeleted : styles.statusActive
                        }`}
                      >
                        {msg.isDeleted ? 'Eliminato' : 'Attivo'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {!msg.isDeleted && (
                          <>
                            <button
                              className={`${styles.actionBtn} ${styles.dismiss}`}
                              onClick={() => handleSoftDelete(msg._id)}
                            >
                              Archivia
                            </button>
                            <button
                              className={`${styles.actionBtn} ${styles.delete}`}
                              onClick={() => handleHardDelete(msg._id)}
                            >
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
                  <button onClick={() => setPage((p) => p - 1)} disabled={!pagination.hasPrevPage}>
                    Precedente
                  </button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={!pagination.hasNextPage}>
                    Successiva
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
