'use client';

import { useState, useEffect, useRef } from 'react';
import { useForumPosts } from '@/hooks/useForumPosts';
import { useForumDiscussion } from '@/hooks/useForumDiscussions';
import { useForumStore } from '@/store/forumStore';
import { PostCard } from '../cards/PostCard';
import { ReplyForm } from '../ui/ReplyForm';
import { Pagination } from '../ui/Pagination';
import styles from '@/styles/components/forum/ThreadView.module.scss';

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
  const navigateToDiscussions = useForumStore((s) => s.navigateToDiscussions);

  const [page, setPage] = useState(1);
  const [replyToPostId, setReplyToPostId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: discussionData, isLoading: isLoadingDiscussion } = useForumDiscussion(
    topicSlug,
    discussionSlug
  );
  const { data: postsData, isLoading: isLoadingPosts } = useForumPosts(
    topicSlug,
    discussionSlug,
    page
  );

  useEffect(() => {
    if (postId && scrollRef.current) {
      const el = document.getElementById(`post-${postId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [postId, postsData?.items]);

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
  const posts = postsData?.items ?? [];
  const pagination = postsData?.pagination;

  if (!discussion) {
    return (
      <div className={styles.empty}>
        Discussione non trovata.
      </div>
    );
  }

  return (
    <div className={styles.container} ref={scrollRef}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigateToDiscussions(topicSlug)}
        >
          ← Torna alle discussioni
        </button>
        <h1 className={styles.title}>{discussion.title}</h1>
        <div className={styles.meta}>
          <span>di {discussion.createdBy.characterName}</span>
          <span>{formatDate(discussion.createdAt)}</span>
          <span>{discussion.postCount} messaggi</span>
          <span>{discussion.viewCount} visualizzazioni</span>
        </div>
        {discussion.tags && discussion.tags.length > 0 && (
          <div className={styles.tags}>
            {discussion.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={styles.posts}>
        {posts.length === 0 ? (
          <div className={styles.empty}>Nessun contenuto</div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onReply={(id) => setReplyToPostId(id)}
            />
          ))
        )}
      </div>

      {!discussion.isLocked && (
        <div className={styles.replySection}>
          <ReplyForm
            topicSlug={topicSlug}
            discussionSlug={discussionSlug}
            replyToPostId={replyToPostId}
            onSuccess={() => setReplyToPostId(null)}
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
