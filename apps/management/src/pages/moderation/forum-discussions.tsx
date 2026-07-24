import React, { useState, useCallback } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import {
  useForumDiscussionsAdmin,
  useUpdateForumDiscussionAdmin,
  useDeleteForumDiscussionAdmin,
  useRestoreForumDiscussionAdmin,
} from '@/hooks/api/useForumModeration';
import { useForumTopics } from '@/hooks/api/useForumTopics';
import { useNotificationStore } from '@/store/notificationStore';
import { API_CONFIG } from '@/constants/config';
import type { ForumDiscussionAdmin } from '@/types/api/ForumModeration';
import styles from '@/styles/pages/AutoModeration.module.scss';

export default function ForumDiscussionsModerationPage() {
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [topicSlug, setTopicSlug] = useState('');
  const [isLockedFilter, setIsLockedFilter] = useState<'' | 'true' | 'false'>('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [movingDiscussion, setMovingDiscussion] = useState<ForumDiscussionAdmin | null>(null);
  const [moveTargetTopicId, setMoveTargetTopicId] = useState('');

  const params = {
    page,
    limit: 25,
    ...(search && { search }),
    ...(topicSlug && { topicSlug }),
    ...(isLockedFilter && { isLocked: isLockedFilter === 'true' }),
    includeDeleted,
  };

  const { data, isLoading, error } = useForumDiscussionsAdmin(params);
  const { data: topicsData } = useForumTopics({ page: 1, pageSize: 200 });
  const updateMutation = useUpdateForumDiscussionAdmin();
  const deleteMutation = useDeleteForumDiscussionAdmin();
  const restoreMutation = useRestoreForumDiscussionAdmin();

  const copyForumUrl = useCallback((discussion: ForumDiscussionAdmin) => {
    const url = `${API_CONFIG.GAME_URL}/forum/${discussion.topicSlug}/${discussion.slug}`;
    navigator.clipboard.writeText(url).then(
      () => addNotification({ type: 'success', message: 'URL copiato negli appunti' }),
      () => addNotification({ type: 'error', message: 'Impossibile copiare l\'URL' })
    );
  }, [addNotification]);

  const togglePin = (discussion: ForumDiscussionAdmin) => {
    updateMutation.mutate(
      { discussionId: discussion._id, data: { isPinned: !discussion.isPinned } },
      {
        onSuccess: () => addNotification({ type: 'success', message: discussion.isPinned ? 'Discussione rimossa dai fissati' : 'Discussione fissata' }),
        onError: (err: Error) => addNotification({ type: 'error', message: err.message }),
      }
    );
  };

  const toggleLock = (discussion: ForumDiscussionAdmin) => {
    updateMutation.mutate(
      { discussionId: discussion._id, data: { isLocked: !discussion.isLocked } },
      {
        onSuccess: () => addNotification({ type: 'success', message: discussion.isLocked ? 'Discussione riaperta' : 'Discussione chiusa' }),
        onError: (err: Error) => addNotification({ type: 'error', message: err.message }),
      }
    );
  };

  const handleDelete = (discussion: ForumDiscussionAdmin) => {
    if (!confirm(`Eliminare la discussione "${discussion.title}"? Sarà ripristinabile in seguito.`)) return;
    deleteMutation.mutate(discussion._id, {
      onSuccess: () => addNotification({ type: 'success', message: 'Discussione eliminata' }),
      onError: (err: Error) => addNotification({ type: 'error', message: err.message }),
    });
  };

  const handleRestore = (discussion: ForumDiscussionAdmin) => {
    restoreMutation.mutate(discussion._id, {
      onSuccess: () => addNotification({ type: 'success', message: 'Discussione ripristinata' }),
      onError: (err: Error) => addNotification({ type: 'error', message: err.message }),
    });
  };

  const openMove = (discussion: ForumDiscussionAdmin) => {
    setMovingDiscussion(discussion);
    setMoveTargetTopicId('');
  };

  const handleMove = () => {
    if (!movingDiscussion || !moveTargetTopicId) return;
    updateMutation.mutate(
      { discussionId: movingDiscussion._id, data: { topicId: moveTargetTopicId } },
      {
        onSuccess: () => {
          addNotification({ type: 'success', message: 'Discussione spostata' });
          setMovingDiscussion(null);
        },
        onError: (err: Error) => addNotification({ type: 'error', message: err.message }),
      }
    );
  };

  if (isLoading) {
    return <ManagementLayout><div className={styles.loading}>Caricamento discussioni...</div></ManagementLayout>;
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

  const discussions = data?.list || [];
  const pagination = data?.pagination;
  const topics = topicsData?.list || [];

  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | Moderazione Discussioni Forum</title>
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1>Moderazione Discussioni</h1>
            <p>Fissa, chiudi, sposta, elimina o ripristina le discussioni del forum</p>
          </div>
        </header>

        <div className={styles.filters}>
          <label>
            Cerca titolo
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Titolo..." />
          </label>
          <label>
            Argomento
            <select value={topicSlug} onChange={(e) => { setTopicSlug(e.target.value); setPage(1); }}>
              <option value="">Tutti</option>
              {topics.map((t) => (
                <option key={t._id} value={t.slug}>{t.title}</option>
              ))}
            </select>
          </label>
          <label>
            Stato
            <select value={isLockedFilter} onChange={(e) => { setIsLockedFilter(e.target.value as '' | 'true' | 'false'); setPage(1); }}>
              <option value="">Tutte</option>
              <option value="false">Solo aperte</option>
              <option value="true">Solo chiuse</option>
            </select>
          </label>
          <label>
            <input type="checkbox" checked={includeDeleted} onChange={(e) => { setIncludeDeleted(e.target.checked); setPage(1); }} />
            {' '}Includi eliminate
          </label>
        </div>

        <div className={styles.tableWrapper}>
          {discussions.length === 0 ? (
            <div className={styles.empty}>Nessuna discussione trovata</div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Titolo</th>
                    <th>Argomento</th>
                    <th>Autore</th>
                    <th>Post</th>
                    <th>Stato</th>
                    <th>Ultimo post</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {discussions.map((d) => (
                    <tr key={d._id}>
                      <td>
                        <button className={styles.locationLink} onClick={() => copyForumUrl(d)} title="Copia URL discussione">
                          {d.title}
                        </button>
                      </td>
                      <td>{d.topicSlug}</td>
                      <td>{d.createdBy.characterName}</td>
                      <td>{d.postCount}</td>
                      <td>
                        {d.isDeleted && <span className={styles.statusBadge}>Eliminata</span>}
                        {!d.isDeleted && d.isPinned && <span className={styles.statusBadge}>Fissata</span>}
                        {!d.isDeleted && d.isLocked && <span className={styles.statusBadge}>Chiusa</span>}
                      </td>
                      <td>{d.lastPostAt ? new Date(d.lastPostAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                      <td>
                        <div className={styles.actions}>
                          {!d.isDeleted && (
                            <>
                              <button className={styles.actionBtn} onClick={() => togglePin(d)}>{d.isPinned ? 'Sfissa' : 'Fissa'}</button>
                              <button className={styles.actionBtn} onClick={() => toggleLock(d)}>{d.isLocked ? 'Riapri' : 'Chiudi'}</button>
                              <button className={styles.actionBtn} onClick={() => openMove(d)}>Sposta</button>
                              <button className={`${styles.actionBtn} ${styles.dismiss}`} onClick={() => handleDelete(d)}>Elimina</button>
                            </>
                          )}
                          {d.isDeleted && (
                            <button className={`${styles.actionBtn} ${styles.review}`} onClick={() => handleRestore(d)}>Ripristina</button>
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
                    Pagina {pagination.currentPage} di {pagination.totalPages} ({pagination.totalItems} totali)
                  </span>
                  <div className={styles.paginationButtons}>
                    <button onClick={() => setPage((p) => p - 1)} disabled={pagination.currentPage <= 1}>Precedente</button>
                    <button onClick={() => setPage((p) => p + 1)} disabled={pagination.currentPage >= pagination.totalPages}>Successiva</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {movingDiscussion && (
        <div className={styles.modal} onClick={() => setMovingDiscussion(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Sposta discussione</h3>

            <div className={styles.modalField}>
              <label>Discussione</label>
              <div className={styles.modalValue}>{movingDiscussion.title}</div>
            </div>

            <div className={styles.modalField}>
              <label>Argomento di destinazione</label>
              <select value={moveTargetTopicId} onChange={(e) => setMoveTargetTopicId(e.target.value)}>
                <option value="">Seleziona...</option>
                {topics.filter((t) => t.slug !== movingDiscussion.topicSlug).map((t) => (
                  <option key={t._id} value={t._id}>{t.title}</option>
                ))}
              </select>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setMovingDiscussion(null)}>Annulla</button>
              <button className={styles.confirmBtn} onClick={handleMove} disabled={!moveTargetTopicId || updateMutation.isPending}>
                {updateMutation.isPending ? 'Spostamento...' : 'Sposta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ManagementLayout>
  );
}
