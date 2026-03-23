/**
 * Abilità Tab Component
 *
 * Shows character skills with permission-based filtering:
 * - All skills for owner
 * - Only visible skills for others (professional skills + high-level skills)
 * - Professional skills highlighted with 🎯 icon
 * - Two-column responsive layout
 *
 * @module components/character/tabs/AbilitaTab
 * @since 2.0.0
 */

'use client';

import classNames from 'classnames';

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';
import styles from '@/styles/components/character/CharacterSheetTab.module.scss';

interface AbilitaTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function AbilitaTab({ character, permissions, visibleSkills }: AbilitaTabProps): JSX.Element {
  const skills = character.skills || {};

  // Filter skills based on permissions
  const skillEntries = Object.entries(skills).filter(([skillId]) =>
    permissions.isOwner || visibleSkills.includes(skillId)
  );

  // Sort skills alphabetically by name
  const sortedSkills = skillEntries.sort(([, a], [, b]) =>
    (a.name || '').localeCompare(b.name || '')
  );

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>
        🎯 Abilità del Personaggio
      </h2>

      {/* Permission Info */}
      {!permissions.isOwner && (
        <div className={styles.calloutInfo}>
          ℹ️ Stai visualizzando solo le abilità professionali e quelle sopra il 40%
        </div>
      )}

      {/* Skills Count */}
      <div className={styles.skillsMeta}>
        Mostrando {sortedSkills.length} abilità
        {!permissions.isOwner && ` su ${Object.keys(skills).length} totali`}
      </div>

      {/* Skills Grid */}
      {sortedSkills.length > 0 ? (
        <div className={styles.gridAuto280}>
          {sortedSkills.map(([skillId, skillData]) => (
            <SkillRow
              key={skillId}
              name={skillData.name || 'Unknown Skill'}
              total={skillData.total || 0}
              base={skillData.base}
              manualPoints={skillData.manualPoints}
              occupationBonus={skillData.occupationBonus || 0}
              showBreakdown={permissions.canViewSkillBreakdown}
            />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎯</div>
          <p>Nessuna abilità disponibile</p>
        </div>
      )}
    </div>
  );
}

// Helper Component
function SkillRow({
  name,
  total,
  base,
  manualPoints,
  occupationBonus,
  showBreakdown
}: {
  name: string;
  total: number;
  base?: number;
  manualPoints?: number;
  occupationBonus: number;
  showBreakdown: boolean;
}) {
  const isProfessional = occupationBonus > 0;
  const totalClass =
    total >= 75 ? styles.skillTotalHigh : total >= 50 ? styles.skillTotalMid : styles.skillTotalLow;

  return (
    <div className={classNames(styles.skillRow, isProfessional && styles.skillRowPro)}>
      <div className={styles.skillNameRow}>
        {isProfessional && <span>🎯</span>}
        <span className={classNames(styles.skillName, isProfessional && styles.skillNameBold)}>
          {name}
        </span>
      </div>
      <div className={styles.skillRight}>
        {showBreakdown && (base !== undefined || manualPoints !== undefined) && (
          <span className={styles.skillBreakdown}>
            {[
              base !== undefined && `Base: ${base}`,
              manualPoints !== undefined && `+${manualPoints}`,
              occupationBonus > 0 && `Occ: +${occupationBonus}`
            ].filter(Boolean).join(', ')}
          </span>
        )}
        <span className={totalClass}>
          {total}%
        </span>
      </div>
    </div>
  );
}
