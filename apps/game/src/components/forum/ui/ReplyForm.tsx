'use client';

import { useState } from 'react';
import { useCreatePost } from '@/hooks/useForumPosts';
import { useUIStore } from '@/store/uiStore';
import styles from '@/styles/components/forum/ReplyForm.module.scss';

interface ReplyFormProps {
  topicSlug: string;
  discussionSlug: string;
  replyToPostId?: string | null;
  onSuccess?: () => void;
}

export function ReplyForm({
  topicSlug,
  discussionSlug,
  replyToPostId,
  onSuccess,
}: ReplyFormProps): JSX.Element {
  const [content, setContent] = useState('');
  const addToast = useUIStore((s) => s.addToast);
  const createPost = useCreatePost();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      await createPost.mutateAsync({
        topicSlug,
        discussionSlug,
        data: { content: content.trim(), replyToPostId: replyToPostId ?? undefined },
      });
      setContent('');
      addToast({ type: 'success', message: 'Messaggio inviato con successo' });
      onSuccess?.();
    } catch {
      addToast({ type: 'error', message: 'Errore nell\'invio del messaggio' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={replyToPostId ? 'Rispondi al messaggio...' : 'Scrivi un messaggio...'}
        className={styles.textarea}
        rows={3}
        disabled={createPost.isPending}
      />
      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={createPost.isPending || !content.trim()}
        >
          {createPost.isPending ? 'Invio...' : 'Invia'}
        </button>
      </div>
    </form>
  );
}
