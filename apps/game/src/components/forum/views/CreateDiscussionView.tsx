'use client';

import { useState } from 'react';

import { useCreateDiscussion } from '@/hooks/useForumDiscussions';
import { useForumTopic } from '@/hooks/useForumTopics';
import { useForumStore } from '@/store/forumStore';
import { useUIStore } from '@/store/uiStore';
import styles from '@/styles/components/forum/CreateDiscussionView.module.scss';
import type { DiscussionVisibilityType } from '@/types/forum';

const VISIBILITY_OPTIONS: { value: DiscussionVisibilityType; label: string }[] = [
  { value: 'public', label: 'Pubblico (visibile a chi accede alla bacheca)' },
  { value: 'staff', label: 'Solo staff' },
  { value: 'corporation', label: 'Solo gruppo selezionato' },
  { value: 'characterList', label: 'Solo personaggi selezionati' },
  { value: 'private', label: 'Privato (solo io e lo staff)' },
];

export function CreateDiscussionView(): JSX.Element {
  const topicSlug = useForumStore((s) => s.topicSlug);
  const navigateToThread = useForumStore((s) => s.navigateToThread);
  const navigateToDiscussions = useForumStore((s) => s.navigateToDiscussions);
  const addToast = useUIStore((s) => s.addToast);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [visibilityType, setVisibilityType] = useState<DiscussionVisibilityType>('public');
  const [corporationId, setCorporationId] = useState('');
  const [characterIdsInput, setCharacterIdsInput] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const { data: topic } = useForumTopic(topicSlug);
  const createDiscussion = useCreateDiscussion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicSlug || !title.trim() || !content.trim()) return;

    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const visibility = visibilityType === 'public'
        ? undefined
        : visibilityType === 'corporation'
          ? { type: visibilityType, corporationId: corporationId.trim() }
          : visibilityType === 'characterList'
            ? {
                type: visibilityType,
                characterIds: characterIdsInput.split(',').map((id) => id.trim()).filter(Boolean),
              }
            : { type: visibilityType };

      const result = await createDiscussion.mutateAsync({
        topicSlug,
        data: {
          title: title.trim(),
          content: content.trim(),
          tags: tags.length > 0 ? tags : undefined,
          visibility,
          isAnonymous: topic?.mode === 'ON' && isAnonymous,
        },
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
        <div className={styles.field}>
          <label htmlFor="discussion-visibility" className={styles.label}>
            Visibilità
          </label>
          <select
            id="discussion-visibility"
            value={visibilityType}
            onChange={(e) => setVisibilityType(e.target.value as DiscussionVisibilityType)}
            className={styles.input}
          >
            {VISIBILITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {visibilityType === 'corporation' && (
          <div className={styles.field}>
            <label htmlFor="discussion-corporation" className={styles.label}>
              ID gruppo/corporazione
            </label>
            <input
              id="discussion-corporation"
              type="text"
              value={corporationId}
              onChange={(e) => setCorporationId(e.target.value)}
              placeholder="ID della corporazione"
              className={styles.input}
              required
            />
          </div>
        )}
        {visibilityType === 'characterList' && (
          <div className={styles.field}>
            <label htmlFor="discussion-characters" className={styles.label}>
              ID personaggi ammessi (separati da virgola)
            </label>
            <input
              id="discussion-characters"
              type="text"
              value={characterIdsInput}
              onChange={(e) => setCharacterIdsInput(e.target.value)}
              placeholder="ID personaggio, ID personaggio, ..."
              className={styles.input}
              required
            />
          </div>
        )}
        {topic?.mode === 'ON' && (
          <div className={styles.field}>
            <label className={styles.label}>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              {' '}Pubblica anonimamente
            </label>
          </div>
        )}
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
