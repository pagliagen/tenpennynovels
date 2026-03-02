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

interface NoteMasterTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function NoteMasterTab({ character, permissions }: NoteMasterTabProps): JSX.Element {
  const reviews = character.reviewHistory || [];

  return (
    <div style={{ padding: '1.5rem', color: '#e8e0d5', fontFamily: 'Georgia, serif' }}>
      <h2 style={{ color: '#ff9500', marginBottom: '1.5rem', fontSize: '1.5rem', borderBottom: '2px solid rgba(255, 149, 0, 0.3)', paddingBottom: '0.5rem' }}>
        🎭 Note Master
      </h2>

      {permissions.canViewReviewHistory ? (
        reviews.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reviews.map((review, index) => (
              <div key={index} style={{
                background: 'rgba(40, 30, 20, 0.6)',
                border: '1px solid rgba(255, 149, 0, 0.3)',
                borderRadius: '6px',
                padding: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#999' }}>
                  <span>👤 {review.author} ({review.authorRole})</span>
                  <span>📅 {new Date(review.date).toLocaleDateString('it-IT')}</span>
                </div>
                <p style={{ margin: 0, lineHeight: '1.6', color: '#ffe4b5' }}>{review.notes}</p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
            <p>Nessuna nota del master disponibile</p>
          </div>
        )
      ) : (
        <div style={{ background: 'rgba(139, 69, 19, 0.3)', border: '2px solid rgba(255, 149, 0, 0.4)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔒</div>
          <h3 style={{ color: '#ff9500', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Accesso Negato</h3>
          <p style={{ color: '#999' }}>Solo il proprietario e i game masters possono visualizzare le note di revisione.</p>
        </div>
      )}
    </div>
  );
}
