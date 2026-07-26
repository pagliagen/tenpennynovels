import React, { useState, useCallback } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import {
  useForumPostsAdmin,
  usePinForumPostAdmin,
  useDeleteForumPostAdmin,
  useRestoreForumPostAdmin,
} from '@/hooks/api/useForumModeration';
import { useNotificationStore } from '@/store/notificationStore';
import { API_CONFIG } from '@/constants/config';
import type { ForumPostAdmin } from '@/types/api/ForumModeration';
import styles from '@/styles/pages/AutoModeration.module.scss';

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

export default function ForumPostsModerationPage() {
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [topicSlug, setTopicSlug] = useState('');
  const [discussionSlug, setDiscussionSlug] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const params = {
    page,
    limit: 25,
    ...(search && { search }),
    ...(topicSlug && { topicSlug }),
    ...(discussionSlug && { discussionSlug }),
    includeDeleted,
  };

  const { data, isLoading, error } = useForumPostsAdmin(params);
  const pinMutation = usePinForumPostAdmin();
  const deleteMutation = useDeleteForumPostAdmin();
  const restoreMutation = useRestoreForumPostAdmin();

  const copyForumUrl = useCallback((post: ForumPostAdmin) => {
    const url = `${API_CONFIG.GAME_URL}/forum/${post.topicSlug}/${post.discussionSlug}`;
    navigator.clipboard.writeText(url).then(
      () => addNotification({ type: 'success', message: 'URL copiato negli appunti' }),
      () => addNotification({ type: 'error', message: 'Impossibile copiare l\'URL' })
    );
  }, [addNotification]);

  const togglePin = (post: ForumPostAdmin) => {
    pinMutation.mutate(
      { postId: post._id, pinned: !post.isPinned },
      {
        onSuccess: () => addNotification({ type: 'success', message: post.isPinned ? 'Post rimosso dai fissati' : 'Post fissato' }),
        onError: (err: Error) => addNotification({ type: 'error', message: err.message }),
      }
    );
  };

  const handleDelete = (post: ForumPostAdmin) => {
    if (!confirm('Eliminare questo post? Sarà ripristinabile in seguito.')) return;
    deleteMutation.mutate(post._id, {
      onSuccess: () => addNotification({ type: 'success', message: 'Post eliminato' }),
      onError: (err: Error) => addNotification({ type: 'error', message: err.message }),
    });
  };

  const handleRestore = (post: ForumPostAdmin) => {
    restoreMutation.mutate(post._id, {
      onSuccess: () => addNotification({ type: 'success', message: 'Post ripristinato' }),
      onError: (err: Error) => addNotification({ type: 'error', message: err.message }),
    });
  };

  if (isLoading) {
    return <ManagementLayout><div className={styles.loading}>Caricamento post...</div></ManagementLayout>;
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

  const posts = data?.list || [];
  const pagination = data?.pagination;

  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | Moderazione Post Forum</title>
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1>Moderazione Post</h1>
            <p>Fissa, elimina o ripristina i singoli post del forum</p>
          </div>
        </header>

        <div className={styles.filters}>
          <label>
            Cerca contenuto
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Testo..." />
          </label>
          <label>
            Argomento
            <input type="text" value={topicSlug} onChange={(e) => { setTopicSlug(e.target.value); setPage(1); }} placeholder="slug argomento" />
          </label>
          <label>
            Discussione
            <input type="text" value={discussionSlug} onChange={(e) => { setDiscussionSlug(e.target.value); setPage(1); }} placeholder="slug discussione" />
          </label>
          <label>
            <input type="checkbox" checked={includeDeleted} onChange={(e) => { setIncludeDeleted(e.target.checked); setPage(1); }} />
            {' '}Includi eliminati
          </label>
        </div>

        <div className={styles.tableWrapper}>
          {posts.length === 0 ? (
            <div className={styles.empty}>Nessun post trovato</div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Autore</th>
                    <th>Discussione</th>
                    <th>Anteprima</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p._id}>
                      <td>{new Date(p.createdAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{p.author.characterName}{p.isAnonymous ? ' (anonimo)' : ''}</td>
                      <td>
                        <button className={styles.locationLink} onClick={() => copyForumUrl(p)} title="Copia URL discussione">
                          {p.topicSlug}/{p.discussionSlug}
                        </button>
                      </td>
                      <td><div className={styles.contentPreview} title={stripHtml(p.content)}>{stripHtml(p.content)}</div></td>
                      <td>
                        {p.isDeleted && <span className={styles.statusBadge}>Eliminato</span>}
                        {!p.isDeleted && p.isPinned && <span className={styles.statusBadge}>Fissato</span>}
                        {!p.isDeleted && p.moderationLabel === 'toxic' && <span className={styles.statusBadge}>Tossico</span>}
                      </td>
                      <td>
                        <div className={styles.actions}>
                          {!p.isDeleted && (
                            <>
                              <button className={styles.actionBtn} onClick={() => togglePin(p)}>{p.isPinned ? 'Sfissa' : 'Fissa'}</button>
                              <button className={`${styles.actionBtn} ${styles.dismiss}`} onClick={() => handleDelete(p)}>Elimina</button>
                            </>
                          )}
                          {p.isDeleted && (
                            <button className={`${styles.actionBtn} ${styles.review}`} onClick={() => handleRestore(p)}>Ripristina</button>
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
    </ManagementLayout>
  );
}
