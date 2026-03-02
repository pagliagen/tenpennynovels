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

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';

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
    <div style={{ padding: '1.5rem', color: '#e8e0d5', fontFamily: 'Georgia, serif' }}>
      <h2 style={{ color: '#ff9500', marginBottom: '1.5rem', fontSize: '1.5rem', borderBottom: '2px solid rgba(255, 149, 0, 0.3)', paddingBottom: '0.5rem' }}>
        🎯 Abilità del Personaggio
      </h2>

      {/* Permission Info */}
      {!permissions.isOwner && (
        <div style={{
          background: 'rgba(255, 149, 0, 0.1)',
          border: '1px solid rgba(255, 149, 0, 0.3)',
          borderRadius: '6px',
          padding: '0.75rem',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          color: '#fbbf24'
        }}>
          ℹ️ Stai visualizzando solo le abilità professionali e quelle sopra il 40%
        </div>
      )}

      {/* Skills Count */}
      <div style={{ marginBottom: '1rem', color: '#999', fontSize: '0.875rem' }}>
        Mostrando {sortedSkills.length} abilità
        {!permissions.isOwner && ` su ${Object.keys(skills).length} totali`}
      </div>

      {/* Skills Grid */}
      {sortedSkills.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '0.5rem'
        }}>
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
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#999'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
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

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.625rem 0.75rem',
      background: isProfessional ? 'rgba(255, 149, 0, 0.15)' : 'rgba(40, 30, 20, 0.4)',
      border: `1px solid ${isProfessional ? 'rgba(255, 149, 0, 0.4)' : 'rgba(255, 149, 0, 0.2)'}`,
      borderRadius: '4px',
      fontSize: '0.9375rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
        {isProfessional && <span style={{ fontSize: '1rem' }}>🎯</span>}
        <span style={{ color: '#ffe4b5', fontWeight: isProfessional ? 600 : 400 }}>
          {name}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {showBreakdown && (base !== undefined || manualPoints !== undefined) && (
          <span style={{ fontSize: '0.75rem', color: '#999' }}>
            ({[
              base !== undefined && `Base: ${base}`,
              manualPoints !== undefined && `+${manualPoints}`,
              occupationBonus > 0 && `Occ: +${occupationBonus}`
            ].filter(Boolean).join(', ')})
          </span>
        )}
        <span style={{
          fontWeight: 'bold',
          color: total >= 75 ? '#4ade80' : total >= 50 ? '#fbbf24' : '#ffe4b5',
          minWidth: '3rem',
          textAlign: 'right'
        }}>
          {total}%
        </span>
      </div>
    </div>
  );
}
