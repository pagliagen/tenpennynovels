'use client';

import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useWebSocket } from '@/contexts/WebSocketContext';
import { useBroadcastDiscussion, useForumDiscussion, useToggleDiscussionFavorite, useUpdateDiscussion } from '@/hooks/useForumDiscussions';
import { forumPostKeys, useForumPosts } from '@/hooks/useForumPosts';
import { useUpdateForumPreferences } from '@/hooks/useForumPreferences';
import { useForumTopic } from '@/hooks/useForumTopics';
import { useAuthStore } from '@/store/authStore';
import { useForumStore } from '@/store/forumStore';
import { useUIStore } from '@/store/uiStore';
import styles from '@/styles/components/forum/ThreadView.module.scss';
import type { ForumReplyOrder } from '@/types/forum';

import { PostCard } from '../cards/PostCard';
import { Pagination } from '../ui/Pagination';
import { ReplyForm } from '../ui/ReplyForm';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ThreadView(): JSX.Element {
  const topicSlug = useForumStore((s) => s.topicSlug);
  const discussionSlug = useForumStore((s) => s.discussionSlug);
  const postId = useForumStore((s) => s.postId);

  const [page, setPage] = useState(1);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyToPostId, setReplyToPostId] = useState<string | null>(null);
  const [orderOverride, setOrderOverride] = useState<ForumReplyOrder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const replySectionRef = useRef<HTMLDivElement>(null);
  const addToast = useUIStore((s) => s.addToast);

  const { data: discussionData, isLoading: isLoadingDiscussion } = useForumDiscussion(
    topicSlug,
    discussionSlug
  );
  const { data: postsData, isLoading: isLoadingPosts } = useForumPosts(
    topicSlug,
    discussionSlug,
    page,
    orderOverride ?? undefined
  );
  const { data: topic } = useForumTopic(topicSlug);
  const broadcastDiscussion = useBroadcastDiscussion();
  const toggleFavorite = useToggleDiscussionFavorite();
  const updateDiscussion = useUpdateDiscussion();
  const updatePreferences = useUpdateForumPreferences();
  const { onForumEvent } = useWebSocket();
  const queryClient = useQueryClient();
  // Proxy for "might be staff" - same flag PostCard uses to show/hide moderation
  // controls. Real authorization (forum.manage) is always enforced server-side.
  const canModerate = useAuthStore((s) => s.adminPanelAccessFromSession);

  useEffect(() => {
    if (!topicSlug || !discussionSlug) return;
    const unsubscribe = onForumEvent((event) => {
      if (
        event.type === 'forum:post:created' &&
        event.data?.topicSlug === topicSlug &&
        event.data?.discussionSlug === discussionSlug
      ) {
        queryClient.invalidateQueries({ queryKey: forumPostKeys.list(topicSlug, discussionSlug) });
      }
    });
    return unsubscribe;
  }, [onForumEvent, queryClient, topicSlug, discussionSlug]);

  const replyOrder: ForumReplyOrder = postsData?.replyOrder ?? 'asc';

  const handleToggleReplyOrder = () => {
    const next: ForumReplyOrder = replyOrder === 'asc' ? 'desc' : 'asc';
    setOrderOverride(next);
    setPage(1);
    updatePreferences.mutate(next);
  };

  const handleBroadcast = async () => {
    if (!topicSlug || !discussionSlug) return;
    try {
      const result = await broadcastDiscussion.mutateAsync({ topicSlug, discussionSlug });
      addToast({ type: 'success', message: `Segnalazione inviata a ${result.recipientCount} personaggi` });
    } catch {
      addToast({ type: 'error', message: 'Impossibile inviare la segnalazione' });
    }
  };

  const handleToggleFavorite = () => {
    if (!topicSlug || !discussionSlug) return;
    toggleFavorite.mutate({ topicSlug, discussionSlug });
  };

  const handleToggleLock = () => {
    if (!topicSlug || !discussionSlug || !discussionData) return;
    updateDiscussion.mutate(
      { topicSlug, discussionSlug, data: { isLocked: !discussionData.isLocked } },
      {
        onSuccess: () => addToast({
          type: 'success',
          message: discussionData.isLocked ? 'Discussione riaperta' : 'Discussione chiusa',
        }),
        onError: () => addToast({ type: 'error', message: 'Impossibile aggiornare la discussione' }),
      }
    );
  };

  const handleReplyClick = () => {
    setReplyToPostId(null);
    setShowReplyForm(true);
    requestAnimationFrame(() => replySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const handleQuoteClick = (id: string) => {
    setReplyToPostId(id);
    setShowReplyForm(true);
    requestAnimationFrame(() => replySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  useEffect(() => {
    if (postId && scrollRef.current) {
      const el = document.getElementById(`post-${postId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [postId, postsData?.list]);

  useEffect(() => {
    setPage(1);
  }, [topicSlug, discussionSlug]);

  if (!topicSlug || !discussionSlug) {
    return (
      <div className={styles.empty}>
        Nessuna discussione selezionata.
      </div>
    );
  }

  if (isLoadingDiscussion || isLoadingPosts) {
    return <div className={styles.loading}>Caricamento...</div>;
  }

  const discussion = discussionData;
  const posts = postsData?.list ?? [];
  const pagination = postsData?.pagination;
  const quotedPostSource = replyToPostId ? posts.find((p) => p.id === replyToPostId) : null;
  const quotedPost = quotedPostSource
    ? { authorName: quotedPostSource.author.characterName, contentHtml: quotedPostSource.content }
    : null;

  if (!discussion) {
    return (
      <div className={styles.empty}>
        Discussione non trovata.
      </div>
    );
  }

  return (
    <div className={styles.container} ref={scrollRef}>
      {topic?.title && <h1 className={styles.topicHeading}>{topic.title}</h1>}

      <div className={styles.discussionBar}>
        <div className={styles.discussionBarInfo}>
          <h2 className={styles.title}>{discussion.title}</h2>
          <p className={styles.subtitle}>
            creato da {discussion.createdBy.characterName} · {formatDate(discussion.createdAt)} · {discussion.postCount} messaggi · {discussion.viewCount} visualizzazioni
          </p>
        </div>
        <div className={styles.discussionBarActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={handleToggleReplyOrder}
            title="Inverti l'ordine delle risposte (la preferenza viene salvata)"
          >
            {replyOrder === 'asc' ? '↓' : '↑'}
          </button>
          {topic?.mode === 'OFF' && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleBroadcast}
              disabled={broadcastDiscussion.isPending}
              title="Invia una segnalazione con link a questo thread a tutti i personaggi"
            >
              📢
            </button>
          )}
          <button
            type="button"
            className={`${styles.iconBtn} ${discussion.isFavorite ? styles.iconBtnActive : ''}`}
            onClick={handleToggleFavorite}
            disabled={toggleFavorite.isPending}
            title={discussion.isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
          >
            ★
          </button>
          {canModerate && (
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.lockBtn} ${discussion.isLocked ? styles.iconBtnActive : ''}`}
              onClick={handleToggleLock}
              disabled={updateDiscussion.isPending}
              title={discussion.isLocked ? 'Riapri la discussione' : 'Chiudi la discussione (non si potrà più rispondere)'}
            >
              {discussion.isLocked ? '🔓 Riapri discussione' : '🔒 Chiudi discussione'}
            </button>
          )}
        </div>
      </div>

      {discussion.isLocked && (
        <div className={styles.lockedNotice}>🔒 Discussione chiusa: non è più possibile rispondere.</div>
      )}

      {discussion.tags && discussion.tags.length > 0 && (
        <div className={styles.tags}>
          {discussion.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className={styles.posts}>
        {posts.length === 0 ? (
          <div className={styles.empty}>Nessun contenuto</div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              topicMode={topic?.mode}
              onReply={discussion.isLocked ? undefined : handleReplyClick}
              onQuote={discussion.isLocked ? undefined : handleQuoteClick}
            />
          ))
        )}
      </div>

      {!discussion.isLocked && showReplyForm && (
        <div className={styles.replySection} ref={replySectionRef}>
          <ReplyForm
            topicSlug={topicSlug}
            discussionSlug={discussionSlug}
            replyToPostId={replyToPostId}
            quotedPost={quotedPost}
            allowAnonymous={topic?.mode === 'ON'}
            onSuccess={() => {
              setReplyToPostId(null);
              setShowReplyForm(false);
            }}
          />
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
