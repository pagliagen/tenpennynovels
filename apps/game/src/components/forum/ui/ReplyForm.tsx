'use client';

import { useEffect, useState } from 'react';

import { useCreatePost } from '@/hooks/useForumPosts';
import { useUIStore } from '@/store/uiStore';
import styles from '@/styles/components/forum/ReplyForm.module.scss';

import { ForumRichTextEditor } from './ForumRichTextEditor';

interface QuotedPostSeed {
  authorName: string;
  contentHtml: string;
}

interface ReplyFormProps {
  topicSlug: string;
  discussionSlug: string;
  replyToPostId?: string | null;
  /** When set (via the "Cita" button), seeds the editor with a blockquote. */
  quotedPost?: QuotedPostSeed | null;
  /** ON boards only: shows the "post anonymously" checkbox. */
  allowAnonymous?: boolean;
  onSuccess?: () => void;
}

function buildQuoteSeed(quoted: QuotedPostSeed): string {
  return `<blockquote><p><strong>${quoted.authorName} ha scritto:</strong></p>${quoted.contentHtml}</blockquote><p></p>`;
}

export function ReplyForm({
  topicSlug,
  discussionSlug,
  replyToPostId,
  quotedPost,
  allowAnonymous,
  onSuccess,
}: ReplyFormProps): JSX.Element {
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const addToast = useUIStore((s) => s.addToast);
  const createPost = useCreatePost();

  // Re-seed the editor whenever a new "Cita" target is picked.
  useEffect(() => {
    if (quotedPost) {
      setContent(buildQuoteSeed(quotedPost));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyToPostId]);

  const isEmpty = (html: string) => !html.replace(/<[^>]*>/g, '').trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEmpty(content)) return;

    try {
      await createPost.mutateAsync({
        topicSlug,
        discussionSlug,
        data: { content, replyToPostId: replyToPostId ?? undefined, isAnonymous: allowAnonymous && isAnonymous },
      });
      setContent('');
      setIsAnonymous(false);
      addToast({ type: 'success', message: 'Messaggio inviato con successo' });
      onSuccess?.();
    } catch {
      addToast({ type: 'error', message: 'Errore nell\'invio del messaggio' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <ForumRichTextEditor
        content={content}
        onChange={setContent}
        placeholder={replyToPostId ? 'Rispondi al messaggio...' : 'Scrivi un messaggio...'}
        disabled={createPost.isPending}
      />
      <div className={styles.actions}>
        {allowAnonymous && (
          <label className={styles.anonymousLabel}>
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              disabled={createPost.isPending}
            />
            Pubblica anonimamente
          </label>
        )}
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={createPost.isPending || isEmpty(content)}
        >
          {createPost.isPending ? 'Invio...' : 'Invia'}
        </button>
      </div>
    </form>
  );
}
