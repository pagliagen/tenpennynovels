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
import styles from '@/styles/components/character/CharacterSheetTab.module.scss';

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
    <div className={styles.root}>
      <h2 className={styles.title}>
        🎒 Inventario
      </h2>

      {!permissions.isOwner && equipment.length > visibleItems.length && (
        <div className={styles.calloutInfo}>
          ℹ️ Stai visualizzando solo {visibleItems.length} oggetti visibili su {equipment.length} totali
        </div>
      )}

      {visibleItems.length > 0 ? (
        <div className={styles.gridAuto250}>
          {visibleItems.map((item) => (
            <div key={item._id} className={styles.itemCard}>
              <div className={styles.itemHeader}>
                <h4 className={styles.itemName}>{item.name}</h4>
                {item.quantity > 1 && (
                  <span className={styles.qtyBadge}>
                    ×{item.quantity}
                  </span>
                )}
              </div>
              {item.description && (
                <p className={styles.itemDesc}>
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎒</div>
          <p>Nessun oggetto nell'inventario</p>
        </div>
      )}
    </div>
  );
}
