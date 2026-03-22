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

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';
import styles from '@/styles/components/character/CharacterSheetTab.module.scss';

interface NoteMasterTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function NoteMasterTab({ character, permissions }: NoteMasterTabProps): JSX.Element {
  const reviews = character.reviewHistory || [];

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>
        🎭 Note Master
      </h2>

      {permissions.canViewReviewHistory ? (
        reviews.length > 0 ? (
          <div className={styles.reviewList}>
            {reviews.map((review, index) => (
              <div key={index} className={styles.reviewCard}>
                <div className={styles.reviewMeta}>
                  <span>👤 {review.author} ({review.authorRole})</span>
                  <span>📅 {new Date(review.date).toLocaleDateString('it-IT')}</span>
                </div>
                <p className={styles.reviewNotes}>{review.notes}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📝</div>
            <p>Nessuna nota del master disponibile</p>
          </div>
        )
      ) : (
        <div className={styles.lockPanel}>
          <div className={styles.emptyIconSm}>🔒</div>
          <h3 className={styles.lockTitle}>Accesso Negato</h3>
          <p className={styles.lockTextPlain}>Solo il proprietario e i game masters possono visualizzare le note di revisione.</p>
        </div>
      )}
    </div>
  );
}
