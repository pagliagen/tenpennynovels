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

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';

interface InformazioniTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function InformazioniTab({ character }: InformazioniTabProps): JSX.Element {
  return (
    <div style={{ padding: '1.5rem', color: '#e8e0d5', fontFamily: 'Georgia, serif' }}>
      <h2 style={{ color: '#ff9500', marginBottom: '1.5rem', fontSize: '1.5rem', borderBottom: '2px solid rgba(255, 149, 0, 0.3)', paddingBottom: '0.5rem' }}>
        📋 Informazioni Generali
      </h2>

      {/* Basic Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
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
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#ff9500', fontSize: '1.125rem', marginBottom: '0.75rem' }}>
            🎭 Descrizione Fisica
          </h3>
          <p style={{
            background: 'rgba(40, 30, 20, 0.6)',
            padding: '1rem',
            borderRadius: '6px',
            border: '1px solid rgba(255, 149, 0, 0.2)',
            lineHeight: '1.6'
          }}>
            {character.physicalDescription}
          </p>
        </div>
      )}

      {/* Public Description */}
      {character.publicBackground && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#ff9500', fontSize: '1.125rem', marginBottom: '0.75rem' }}>
            📜 Descrizione Pubblica
          </h3>
          <p style={{
            background: 'rgba(40, 30, 20, 0.6)',
            padding: '1rem',
            borderRadius: '6px',
            border: '1px solid rgba(255, 149, 0, 0.2)',
            lineHeight: '1.6'
          }}>
            {character.publicBackground}
          </p>
        </div>
      )}

      {/* Stats Preview */}
      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ color: '#ff9500', fontSize: '1.125rem', marginBottom: '0.75rem' }}>
          ⚡ Statistiche Rapide
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
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
    <div style={{
      background: 'rgba(40, 30, 20, 0.4)',
      padding: '0.75rem',
      borderRadius: '4px',
      border: '1px solid rgba(255, 149, 0, 0.2)'
    }}>
      <div style={{ fontSize: '0.8125rem', color: '#999', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#ffe4b5' }}>{value}</div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'rgba(40, 30, 20, 0.6)',
      padding: '0.75rem',
      borderRadius: '6px',
      border: `2px solid ${color}40`,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color }}>{value}</div>
    </div>
  );
}
