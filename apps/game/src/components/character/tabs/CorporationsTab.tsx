/**
 * Corporations Tab Component
 *
 * Shows character corporation memberships:
 * - List of corporations with roles
 * - Member permissions
 * - Corporation logos/avatars
 *
 * TODO: Integrate with existing CorporationDashboard component
 *
 * @module components/character/tabs/CorporationsTab
 * @since 2.0.0
 */

'use client';

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';

interface CorporationsTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function CorporationsTab({ character, permissions }: CorporationsTabProps): JSX.Element {
  const memberships = character.memberships || [];

  return (
    <div style={{ padding: '1.5rem', color: '#e8e0d5', fontFamily: 'Georgia, serif' }}>
      <h2 style={{ color: '#ff9500', marginBottom: '1.5rem', fontSize: '1.5rem', borderBottom: '2px solid rgba(255, 149, 0, 0.3)', paddingBottom: '0.5rem' }}>
        🏛️ Corporations
      </h2>

      {memberships.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {memberships.map((membership, index) => (
            <div key={index} style={{
              background: 'rgba(40, 30, 20, 0.6)',
              border: '1px solid rgba(255, 149, 0, 0.3)',
              borderRadius: '6px',
              padding: '1rem'
            }}>
              {/* TODO: Add corporationAvatar when backend provides it */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, color: '#ff9500', fontSize: '1.125rem' }}>
                    {membership.corporationName}
                  </h3>
                  <div style={{ fontSize: '0.875rem', color: '#fbbf24', marginTop: '0.25rem' }}>
                    👤 Ruolo: <strong>{membership.role || 'Membro'}</strong>
                  </div>
                </div>
              </div>

              {/* Permissions/Capabilities */}
              {membership.permissions && membership.permissions.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    🔑 Permessi:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {membership.permissions.map((permission, pIndex) => (
                      <span key={pIndex} style={{
                        background: 'rgba(255, 149, 0, 0.2)',
                        border: '1px solid rgba(255, 149, 0, 0.4)',
                        borderRadius: '12px',
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.8125rem',
                        color: '#ffe4b5'
                      }}>
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* TODO: Add joinedAt when backend provides it */}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏛️</div>
          <p>Nessuna appartenenza a corporations</p>
          {permissions.isOwner && (
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Unisciti a una corporation per accedere a vantaggi esclusivi!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
