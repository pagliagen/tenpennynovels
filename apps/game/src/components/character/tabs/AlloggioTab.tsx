/**
 * Alloggio Tab Component
 *
 * Shows character housing information:
 * - Current lodging location
 * - Room type and amenities
 * - Rent and payment status
 *
 * TODO: Integrate with existing HousingDashboard component
 *
 * @module components/character/tabs/AlloggioTab
 * @since 2.0.0
 */

'use client';

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';

interface AlloggioTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function AlloggioTab({ character, permissions }: AlloggioTabProps): JSX.Element {
  const housing = character.housing;

  return (
    <div style={{ padding: '1.5rem', color: '#e8e0d5', fontFamily: 'Georgia, serif' }}>
      <h2 style={{ color: '#ff9500', marginBottom: '1.5rem', fontSize: '1.5rem', borderBottom: '2px solid rgba(255, 149, 0, 0.3)', paddingBottom: '0.5rem' }}>
        🏠 Alloggio
      </h2>

      {housing ? (
        <div style={{
          background: 'rgba(40, 30, 20, 0.6)',
          border: '1px solid rgba(255, 149, 0, 0.3)',
          borderRadius: '6px',
          padding: '1.5rem'
        }}>
          {/* Housing Name - Using locationName from actual type */}
          <h3 style={{ color: '#ff9500', fontSize: '1.25rem', marginBottom: '1rem' }}>
            {housing.locationName || 'Alloggio Corrente'}
          </h3>

          {/* Housing Details Grid - Only fields that exist in type */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {housing.locationName && (
              <InfoCard title="📍 Ubicazione" value={housing.locationName} />
            )}
            {housing.roomType && (
              <InfoCard title="🛏️ Tipo Stanza" value={housing.roomType} />
            )}
            {housing.rentPerMonth !== undefined && (
              <InfoCard
                title="💰 Affitto"
                value={`${housing.rentPerMonth} £/mese`}
                color="#fbbf24"
              />
            )}
          </div>

          {/* TODO: Add these fields when backend implements full housing system:
               - image: string
               - description: string
               - amenities: string[]
               - paymentStatus: string
               - moveInDate: Date
          */}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏚️</div>
          <p>Nessun alloggio registrato</p>
          {permissions.isOwner && (
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Trova un alloggio per avere un punto di riferimento nella città!
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Helper Components
function InfoCard({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <div style={{
      background: 'rgba(40, 30, 20, 0.4)',
      padding: '0.75rem',
      borderRadius: '4px',
      border: '1px solid rgba(255, 149, 0, 0.2)'
    }}>
      <div style={{ fontSize: '0.8125rem', color: '#999', marginBottom: '0.25rem' }}>{title}</div>
      <div style={{ fontSize: '1rem', fontWeight: 600, color: color || '#ffe4b5' }}>{value}</div>
    </div>
  );
}
