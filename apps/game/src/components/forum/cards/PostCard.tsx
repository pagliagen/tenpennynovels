'use client';

import { useState } from 'react';

import { useUpdatePost, useDeletePost } from '@/hooks/useForumPosts';
import { useAuthStore } from '@/store/authStore';
import { useForumStore } from '@/store/forumStore';
import { useUIStore } from '@/store/uiStore';
import styles from '@/styles/components/forum/PostCard.module.scss';
import type { ForumPost } from '@/types/forum';

interface PostCardProps {
  post: ForumPost;
  isOwn?: boolean;
  /** Parent topic's mode: 'ON' caps editing to 15 minutes after posting, 'OFF'/undefined leaves it unlimited. */
  topicMode?: 'ON' | 'OFF';
  onReply?: (postId: string) => void;
}

const EDIT_WINDOW_MS = 15 * 60 * 1000;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PostCard({ post, isOwn: isOwnProp, topicMode, onReply }: PostCardProps): JSX.Element {
  const topicSlug = useForumStore((s) => s.topicSlug);
  const discussionSlug = useForumStore((s) => s.discussionSlug);
  const selectedCharacter = useAuthStore((s) => s.selectedCharacter);
  const addToast = useUIStore((s) => s.addToast);
  const isOwn = isOwnProp ?? post.isOwnPost ?? selectedCharacter?._id === post.author.characterId;
  const withinEditWindow = topicMode !== 'ON' || (Date.now() - new Date(post.createdAt).getTime()) < EDIT_WINDOW_MS;
  const canEdit = isOwn && withinEditWindow;

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();

  const handleCopyLink = () => {
    if (!topicSlug || !discussionSlug) return;
    const hash = `#bacheca/${topicSlug}/${discussionSlug}/${post.id}`;
    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}${hash}`);
    addToast({ type: 'success', message: 'Link copiato negli appunti' });
  };

  const handleSaveEdit = async () => {
    if (!topicSlug || !discussionSlug || editContent === post.content) {
      setIsEditing(false);
      return;
    }
    try {
      await updatePost.mutateAsync({
        postId: post.id,
        content: editContent,
        topicSlug,
        discussionSlug,
      });
      setIsEditing(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDelete = async () => {
    if (!topicSlug || !discussionSlug || !confirm('Eliminare questo messaggio?')) return;
    try {
      await deletePost.mutateAsync({ postId: post.id, topicSlug, discussionSlug });
    } catch {
      // Error handled by mutation
    }
  };

  if (post.isDeleted) {
    return (
      <article id={`post-${post.id}`} className={`${styles.card} ${styles.deleted}`}>
        <div className={styles.content}>[Post eliminato]</div>
      </article>
    );
  }

  return (
    <article id={`post-${post.id}`} className={styles.card}>
      <div className={styles.header}>
        <span className={styles.author}>{post.author.characterName}</span>
        {post.isAnonymous && (
          <span className={styles.edited} title={isOwn ? 'Visibile solo a te e allo staff' : undefined}>
            anonimo
          </span>
        )}
        <span className={styles.date}>{formatDate(post.createdAt)}</span>
        {post.isEdited && <span className={styles.edited}>modificato</span>}
      </div>
      {isEditing ? (
        <div className={styles.editArea}>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className={styles.editTextarea}
            rows={4}
          />
          <div className={styles.editActions}>
            <button type="button" className={styles.cancelEditBtn} onClick={() => setIsEditing(false)}>
              Annulla
            </button>
            <button type="button" className={styles.saveEditBtn} onClick={handleSaveEdit} disabled={updatePost.isPending}>
              Salva
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.content}>{post.content}</div>
      )}
      <div className={styles.actions}>
        {onReply && (
          <button type="button" className={styles.actionBtn} onClick={() => onReply(post.id)}>
            Rispondi
          </button>
        )}
        <button type="button" className={styles.actionBtn} onClick={handleCopyLink}>
          Copia link
        </button>
        {isOwn && !isEditing && (
          <>
            {canEdit && (
              <button type="button" className={styles.actionBtn} onClick={() => setIsEditing(true)}>
                Modifica
              </button>
            )}
            <button type="button" className={styles.actionBtn} onClick={handleDelete} disabled={deletePost.isPending}>
              Elimina
            </button>
          </>
        )}
      </div>
    </article>
  );
}
