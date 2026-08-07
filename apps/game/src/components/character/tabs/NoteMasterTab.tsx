/**
 * Note Master Tab Component
 *
 * Shows review history (owner + game masters only):
 * - Chronological list (date, author, notes)
 * - Conditional rendering based on permissions
 *
 * @module components/character/tabs/NoteMasterTab
 * @since 2.0.0
 */

'use client';

import { useState, type FormEvent } from 'react';

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';
import { useCreateMasterNote, useMasterNotes } from '@/hooks/useCharacterMasterNotes';
import styles from '@/styles/components/character/CharacterSheetTab.module.scss';

interface NoteMasterTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function NoteMasterTab({ character, permissions }: NoteMasterTabProps): JSX.Element {
  const reviews = character.reviewHistory || [];

  if (!permissions.canViewReviewHistory) {
    return (
      <div className={styles.root}>
        <h2 className={styles.title}>🎭 Note Master</h2>
        <div className={styles.lockPanel}>
          <div className={styles.emptyIconSm}>🔒</div>
          <h3 className={styles.lockTitle}>Accesso Negato</h3>
          <p className={styles.lockTextPlain}>Solo il proprietario e i game masters possono visualizzare le note del master.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>🎭 Note Master</h2>

      <MasterNoteSection character={character} permissions={permissions} category="general" title="📝 Note" />
      <div className={styles.mtSection}>
        <MasterNoteSection character={character} permissions={permissions} category="damage" title="🩸 Danni (fisici e mentali)" />
      </div>

      {/* Storico approvazione (legacy, sola lettura) */}
      {reviews.length > 0 && (
        <div className={styles.mtSection}>
          <h3 className={styles.sectionTitleLg}>📋 Storico Approvazione</h3>
          <div className={styles.reviewList}>
            {reviews.map((review, index) => (
              <div key={index} className={styles.reviewCard}>
                <div className={styles.reviewMeta}>
                  <span>{review.action}</span>
                  <span>📅 {new Date(review.reviewedAt).toLocaleDateString('it-IT')}</span>
                </div>
                {review.note && <p className={styles.reviewNotes}>{review.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MasterNoteSection({
  character,
  permissions,
  category,
  title
}: {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  category: 'general' | 'damage';
  title: string;
}) {
  const { data, isLoading } = useMasterNotes(character._id, category);
  const createNote = useCreateMasterNote(character._id);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const canWrite = permissions.masterOverride;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await createNote.mutateAsync({ content: content.trim(), category });
    setContent('');
    setShowForm(false);
  };

  return (
    <div>
      <h3 className={styles.sectionTitleLg}>{title}</h3>

      {canWrite && (
        <div className={styles.actionButtonRow} style={{ marginBottom: '1rem' }}>
          <button type="button" className={styles.actionButton} onClick={() => setShowForm((v) => !v)}>
            {showForm ? '✕ Annulla' : '+ Nuova nota'}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className={styles.bodyBox} style={{ marginBottom: '1.5rem' }}>
          <div className={styles.formField}>
            <textarea className={styles.formTextarea} value={content} onChange={(e) => setContent(e.target.value)} maxLength={10000} required />
          </div>
          <button type="submit" className={styles.actionButton} disabled={createNote.isPending}>
            {createNote.isPending ? 'Salvataggio…' : 'Salva nota'}
          </button>
        </form>
      )}

      {isLoading && <p className={styles.lockTextPlain}>Caricamento…</p>}

      {!isLoading && (data?.notes.length ?? 0) === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📝</div>
          <p>Nessuna nota disponibile</p>
        </div>
      )}

      <div className={styles.reviewList}>
        {data?.notes.map((note) => (
          <div key={note._id} className={styles.reviewCard}>
            <div className={styles.reviewMeta}>
              <span>👤 {note.authorName}</span>
              <span>📅 {new Date(note.createdAt).toLocaleDateString('it-IT')}</span>
            </div>
            <p className={styles.reviewNotes}>{note.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
