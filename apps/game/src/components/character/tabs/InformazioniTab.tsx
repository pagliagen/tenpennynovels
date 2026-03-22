/**
 * Informazioni Tab Component
 *
 * Shows basic character information:
 * - Name, age, gender, occupation
 * - Physical/public description
 * - Stats preview (HP, Sanity, Magic)
 *
 * @module components/character/tabs/InformazioniTab
 * @since 2.0.0
 */

'use client';

import type { CSSProperties } from 'react';

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';
import styles from '@/styles/components/character/CharacterSheetTab.module.scss';

interface InformazioniTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function InformazioniTab({ character }: InformazioniTabProps): JSX.Element {
  return (
    <div className={styles.root}>
      <h2 className={styles.title}>
        📋 Informazioni Generali
      </h2>

      {/* Basic Info Grid */}
      <div className={styles.grid2}>
        <InfoField label="Nome" value={character.name} />
        <InfoField label="Età" value={character.age?.toString() || 'N/A'} />
        <InfoField label="Genere" value={character.gender || 'N/A'} />
        <InfoField
          label="Occupazione"
          value={character.occupation?.name || 'Nessuna'}
        />
      </div>

      {/* Physical Description */}
      {character.physicalDescription && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            🎭 Descrizione Fisica
          </h3>
          <div className={styles.bodyBox}>
            <p className={styles.bodyPre}>{character.physicalDescription}</p>
          </div>
        </div>
      )}

      {/* Public Description */}
      {character.publicBackground && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            📜 Descrizione Pubblica
          </h3>
          <div className={styles.bodyBox}>
            <p className={styles.bodyPre}>{character.publicBackground}</p>
          </div>
        </div>
      )}

      {/* Stats Preview */}
      <div className={styles.mtSection}>
        <h3 className={styles.sectionTitle}>
          ⚡ Statistiche Rapide
        </h3>
        <div className={styles.grid3}>
          <StatBox label="HP" value={character.stats?.hp || 0} color="#4ade80" />
          <StatBox label="Sanity" value={character.stats?.sanity || 0} color="#fbbf24" />
          <StatBox label="MP" value={character.stats?.mp || 0} color="#60a5fa" />
        </div>
      </div>
    </div>
  );
}

// Helper Components
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoField}>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>{value}</div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className={styles.statBox}
      style={{ '--stat-accent': color } as CSSProperties}
    >
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );
}
