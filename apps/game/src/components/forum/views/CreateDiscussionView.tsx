'use client';

import { useState } from 'react';
import { useCreateDiscussion } from '@/hooks/useForumDiscussions';
import { useForumStore } from '@/store/forumStore';
import { useUIStore } from '@/store/uiStore';
import styles from '@/styles/components/forum/CreateDiscussionView.module.scss';

export function CreateDiscussionView(): JSX.Element {
  const topicSlug = useForumStore((s) => s.topicSlug);
  const navigateToThread = useForumStore((s) => s.navigateToThread);
  const navigateToDiscussions = useForumStore((s) => s.navigateToDiscussions);
  const addToast = useUIStore((s) => s.addToast);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const createDiscussion = useCreateDiscussion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicSlug || !title.trim() || !content.trim()) return;

    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const result = await createDiscussion.mutateAsync({
        topicSlug,
        data: { title: title.trim(), content: content.trim(), tags: tags.length > 0 ? tags : undefined },
      });
      const slug = result.slug;
      if (slug) {
        navigateToThread(topicSlug, slug);
        addToast({ type: 'success', message: 'Discussione creata con successo' });
      } else {
        addToast({ type: 'error', message: 'Errore: slug non restituito' });
      }
    } catch {
      addToast({ type: 'error', message: 'Errore nella creazione della discussione' });
    }
  };

  const handleCancel = () => {
    if (topicSlug) {
      navigateToDiscussions(topicSlug);
    }
  };

  if (!topicSlug) {
    return (
      <div className={styles.empty}>
        Nessun argomento selezionato.
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Nuova discussione</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="discussion-title" className={styles.label}>
            Titolo
          </label>
          <input
            id="discussion-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Inserisci il titolo della discussione"
            className={styles.input}
            required
            maxLength={200}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="discussion-content" className={styles.label}>
            Contenuto
          </label>
          <textarea
            id="discussion-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Scrivi il contenuto del primo messaggio..."
            className={styles.textarea}
            required
            rows={8}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="discussion-tags" className={styles.label}>
            Tag (separati da virgola)
          </label>
          <input
            id="discussion-tags"
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="es. rpg, avventura, mistero"
            className={styles.input}
          />
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={handleCancel}
            disabled={createDiscussion.isPending}
          >
            Annulla
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={createDiscussion.isPending || !title.trim() || !content.trim()}
          >
            {createDiscussion.isPending ? 'Creazione...' : 'Crea discussione'}
          </button>
        </div>
      </form>
    </div>
  );
}
