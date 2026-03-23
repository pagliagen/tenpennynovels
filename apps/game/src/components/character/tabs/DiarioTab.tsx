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

import type { CSSProperties } from 'react';

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';
import styles from '@/styles/components/character/CharacterSheetTab.module.scss';

interface DiarioTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function DiarioTab({ character }: DiarioTabProps): JSX.Element {
  return (
    <div className={styles.root}>
      <h2 className={styles.title}>
        📔 Diario del Personaggio
      </h2>

      {/* Personality Traits */}
      {character.personalityTraits && character.personalityTraits.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            ✨ Tratti della Personalità
          </h3>
          <div className={styles.traitRow}>
            {character.personalityTraits.map((trait, index) => (
              <span key={index} className={styles.traitPill}>
                {trait}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Metadata Grid */}
      <div className={styles.gridAuto200}>
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
    <div className={styles.diarioCard}>
      <div className={styles.diarioCardTitle}>{title}</div>
      <div
        className={styles.diarioCardValue}
        style={color ? ({ '--accent': color } as CSSProperties) : undefined}
      >
        {value}
      </div>
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
