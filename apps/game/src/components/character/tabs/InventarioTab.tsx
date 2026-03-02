/**
 * Inventario Tab Component
 *
 * Shows character equipment with permission filtering:
 * - Equipment grid with items
 * - Quantity and description
 * - Only visible items for non-owners
 *
 * @module components/character/tabs/InventarioTab
 * @since 2.0.0
 */

'use client';

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';

interface InventarioTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function InventarioTab({ character, permissions, visibleEquipment }: InventarioTabProps): JSX.Element {
  const equipment = character.equipment || [];

  // Filter equipment based on permissions
  const visibleItems = permissions.isOwner
    ? equipment
    : equipment.filter((item) => visibleEquipment.includes(item._id));

  return (
    <div style={{ padding: '1.5rem', color: '#e8e0d5', fontFamily: 'Georgia, serif' }}>
      <h2 style={{ color: '#ff9500', marginBottom: '1.5rem', fontSize: '1.5rem', borderBottom: '2px solid rgba(255, 149, 0, 0.3)', paddingBottom: '0.5rem' }}>
        🎒 Inventario
      </h2>

      {!permissions.isOwner && equipment.length > visibleItems.length && (
        <div style={{ background: 'rgba(255, 149, 0, 0.1)', border: '1px solid rgba(255, 149, 0, 0.3)', borderRadius: '6px', padding: '0.75rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: '#fbbf24' }}>
          ℹ️ Stai visualizzando solo {visibleItems.length} oggetti visibili su {equipment.length} totali
        </div>
      )}

      {visibleItems.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
          {visibleItems.map((item) => (
            <div key={item._id} style={{
              background: 'rgba(40, 30, 20, 0.6)',
              border: '1px solid rgba(255, 149, 0, 0.3)',
              borderRadius: '6px',
              padding: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, color: '#ff9500', fontSize: '1rem' }}>{item.name}</h4>
                {item.quantity > 1 && (
                  <span style={{
                    background: 'rgba(255, 149, 0, 0.3)',
                    borderRadius: '12px',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    ×{item.quantity}
                  </span>
                )}
              </div>
              {item.description && (
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#e8e0d5', lineHeight: '1.5' }}>
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎒</div>
          <p>Nessun oggetto nell'inventario</p>
        </div>
      )}
    </div>
  );
}
