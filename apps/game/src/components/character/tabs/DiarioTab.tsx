/**
 * Diario Tab Component
 *
 * Shows character diary information:
 * - Personality traits
 * - Character status
 * - Creation date, last active
 *
 * @module components/character/tabs/DiarioTab
 * @since 2.0.0
 */

'use client';

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';

interface DiarioTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function DiarioTab({ character }: DiarioTabProps): JSX.Element {
  return (
    <div style={{ padding: '1.5rem', color: '#e8e0d5', fontFamily: 'Georgia, serif' }}>
      <h2 style={{ color: '#ff9500', marginBottom: '1.5rem', fontSize: '1.5rem', borderBottom: '2px solid rgba(255, 149, 0, 0.3)', paddingBottom: '0.5rem' }}>
        📔 Diario del Personaggio
      </h2>

      {/* Personality Traits */}
      {character.personalityTraits && character.personalityTraits.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#ff9500', fontSize: '1.125rem', marginBottom: '0.75rem' }}>
            ✨ Tratti della Personalità
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {character.personalityTraits.map((trait, index) => (
              <span key={index} style={{
                background: 'rgba(255, 149, 0, 0.2)',
                border: '1px solid rgba(255, 149, 0, 0.4)',
                borderRadius: '20px',
                padding: '0.5rem 1rem',
                fontSize: '0.9375rem',
                color: '#ffe4b5'
              }}>
                {trait}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Metadata Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <InfoCard title="📊 Stato" value={getStatusDisplay(character.playerStatus)} color={getStatusColor(character.playerStatus)} />
        {character.createdAt && (
          <InfoCard title="📅 Creato il" value={new Date(character.createdAt).toLocaleDateString('it-IT')} />
        )}
        {character.lastActive && (
          <InfoCard title="⏰ Ultima Attività" value={new Date(character.lastActive).toLocaleDateString('it-IT')} />
        )}
      </div>
    </div>
  );
}

function InfoCard({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'rgba(40, 30, 20, 0.6)', border: '1px solid rgba(255, 149, 0, 0.3)', borderRadius: '6px', padding: '1rem' }}>
      <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>{title}</div>
      <div style={{ fontSize: '1.125rem', fontWeight: 600, color: color || '#ffe4b5' }}>{value}</div>
    </div>
  );
}

function getStatusDisplay(playerStatus?: string): string {
  switch (playerStatus) {
    case 'approved': return 'Approvato';
    case 'pending': return 'In Attesa';
    case 'draft': return 'Bozza';
    default: return 'Sconosciuto';
  }
}

function getStatusColor(playerStatus?: string): string {
  switch (playerStatus) {
    case 'approved': return '#4ade80';
    case 'pending': return '#fbbf24';
    case 'draft': return '#94a3b8';
    default: return '#999';
  }
}
