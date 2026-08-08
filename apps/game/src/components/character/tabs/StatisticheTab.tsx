/**
 * Statistiche Tab Component
 *
 * Shows all character stats in Call of Cthulhu 7th edition format:
 * - 8 base stats (Charm, Constitution, Dexterity, Education, Intelligence, Power, Size, Strength)
 * - 8 derived stats (Damage Bonus, Build, Luck, Idea, Knowledge, MP, Sanity, HP)
 *
 * @module components/character/tabs/StatisticheTab
 * @since 2.0.0
 */

'use client';

import type { CSSProperties } from 'react';
import classNames from 'classnames';

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';
import styles from '@/styles/components/character/CharacterSheetTab.module.scss';

interface StatisticheTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function StatisticheTab({ character }: StatisticheTabProps): JSX.Element {
  const stats = character.stats || {};
  // Le derivate sono un oggetto separato sul backend (Character.ts: stats vs derived),
  // non annidate dentro stats — leggerle da lì restituiva sempre 0/undefined.
  const derived = character.derived || {};

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>
        📊 Statistiche del Personaggio
      </h2>

      {/* Base Stats */}
      <h3 className={styles.sectionTitleLg}>
        ⚡ Caratteristiche Base
      </h3>
      <div className={classNames(styles.gridAuto150, styles.statGridMb)}>
        <StatCard label="Carisma" value={stats.appearance || 0} icon="✨" />
        <StatCard label="Constitution" value={stats.constitution || 0} icon="💪" />
        <StatCard label="Dexterity" value={stats.dexterity || 0} icon="🎯" />
        <StatCard label="Education" value={stats.education || 0} icon="📚" />
        <StatCard label="Intelligence" value={stats.intelligence || 0} icon="🧠" />
        <StatCard label="Power" value={stats.power || 0} icon="⚡" />
        <StatCard label="Size" value={stats.size || 0} icon="📏" />
        <StatCard label="Strength" value={stats.strength || 0} icon="💥" />
      </div>

      {/* Derived Stats */}
      <h3 className={styles.sectionTitleLg}>
        🎲 Caratteristiche Derivate
      </h3>
      <div className={styles.gridAuto150}>
        <StatCard label="HP" value={derived.hitPoints || 0} icon="❤️" highlight="#4ade80" />
        <StatCard label="Sanity" value={derived.sanity || 0} icon="🧘" highlight="#fbbf24" />
        <StatCard label="MP" value={derived.magicPoints || 0} icon="✨" highlight="#60a5fa" />
        <StatCard label="Luck" value={derived.luckRoll || 0} icon="🍀" />
        <StatCard label="Idea" value={derived.ideaRoll || 0} icon="💡" />
        <StatCard label="Knowledge" value={derived.knowledge || 0} icon="📖" />
        <StatCard label="Build" value={derived.build || 0} icon="🏋️" />
        <StatCard
          label="Damage Bonus"
          value={derived.bonusDamage || 'N/A'}
          icon="💥"
          isString
        />
      </div>
    </div>
  );
}

// Helper Component
function StatCard({
  label,
  value,
  icon,
  highlight,
  isString = false
}: {
  label: string;
  value: number | string;
  icon: string;
  highlight?: string;
  isString?: boolean;
}) {
  const varStyle = highlight ? ({ '--highlight': highlight } as CSSProperties) : undefined;

  return (
    <div
      className={highlight ? styles.statCardHighlight : styles.statCardPlain}
      style={varStyle}
    >
      <div className={styles.statCardIcon}>{icon}</div>
      <div className={styles.statCardLabel}>
        {label}
      </div>
      <div
        className={isString ? styles.statCardValueString : styles.statCardValue}
        style={varStyle}
      >
        {value}
      </div>
    </div>
  );
}
