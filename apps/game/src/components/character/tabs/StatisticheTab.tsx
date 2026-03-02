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

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';

interface StatisticheTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function StatisticheTab({ character }: StatisticheTabProps): JSX.Element {
  const stats = character.stats || {};

  return (
    <div style={{ padding: '1.5rem', color: '#e8e0d5', fontFamily: 'Georgia, serif' }}>
      <h2 style={{ color: '#ff9500', marginBottom: '1.5rem', fontSize: '1.5rem', borderBottom: '2px solid rgba(255, 149, 0, 0.3)', paddingBottom: '0.5rem' }}>
        📊 Statistiche del Personaggio
      </h2>

      {/* Base Stats */}
      <h3 style={{ color: '#ff9500', fontSize: '1.25rem', marginBottom: '1rem' }}>
        ⚡ Caratteristiche Base
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '0.75rem',
        marginBottom: '2rem'
      }}>
        <StatCard label="Charm" value={stats.charm || 0} icon="✨" />
        <StatCard label="Constitution" value={stats.constitution || 0} icon="💪" />
        <StatCard label="Dexterity" value={stats.dexterity || 0} icon="🎯" />
        <StatCard label="Education" value={stats.education || 0} icon="📚" />
        <StatCard label="Intelligence" value={stats.intelligence || 0} icon="🧠" />
        <StatCard label="Power" value={stats.power || 0} icon="⚡" />
        <StatCard label="Size" value={stats.size || 0} icon="📏" />
        <StatCard label="Strength" value={stats.strength || 0} icon="💥" />
      </div>

      {/* Derived Stats */}
      <h3 style={{ color: '#ff9500', fontSize: '1.25rem', marginBottom: '1rem' }}>
        🎲 Caratteristiche Derivate
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '0.75rem'
      }}>
        <StatCard label="HP" value={stats.hp || 0} icon="❤️" highlight="#4ade80" />
        <StatCard label="Sanity" value={stats.sanity || 0} icon="🧘" highlight="#fbbf24" />
        <StatCard label="MP" value={stats.mp || 0} icon="✨" highlight="#60a5fa" />
        <StatCard label="Luck" value={stats.luck || 0} icon="🍀" />
        <StatCard label="Idea" value={stats.idea || 0} icon="💡" />
        <StatCard label="Knowledge" value={stats.knowledge || 0} icon="📖" />
        <StatCard label="Build" value={stats.build || 0} icon="🏋️" />
        <StatCard
          label="Damage Bonus"
          value={stats.damageBonus || 'N/A'}
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
  return (
    <div style={{
      background: highlight ? `${highlight}20` : 'rgba(40, 30, 20, 0.6)',
      padding: '1rem',
      borderRadius: '6px',
      border: `2px solid ${highlight || 'rgba(255, 149, 0, 0.3)'}`,
      textAlign: 'center',
      transition: 'transform 0.2s ease'
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{
        fontSize: '0.875rem',
        color: '#999',
        marginBottom: '0.5rem',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: isString ? '1.25rem' : '2rem',
        fontWeight: 'bold',
        color: highlight || '#ffe4b5'
      }}>
        {value}
      </div>
    </div>
  );
}
