/**
 * Inventario Tab Component
 *
 * Due sotto-sezioni: oggetti equipaggiati / non equipaggiati, con azioni
 * equipaggia/disequipaggia, butta e cedi a un altro personaggio.
 *
 * @module components/character/tabs/InventarioTab
 * @since 2.0.0
 */

'use client';

import { useState } from 'react';

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';
import {
  InventoryItemView,
  useCharacterInventory,
  useDiscardItem,
  usePublicCharacterList,
  useSetEquipped,
  useTransferItem
} from '@/hooks/useCharacterInventoryActions';
import styles from '@/styles/components/character/CharacterSheetTab.module.scss';

interface InventarioTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function InventarioTab({ character, permissions }: InventarioTabProps): JSX.Element {
  const { data, isLoading, isError } = useCharacterInventory(character._id);
  const canManage = permissions.editPermissions.inventario && permissions.isOwner;
  const [transferItem, setTransferItem] = useState<InventoryItemView | null>(null);

  if (isError) {
    return (
      <div className={styles.root}>
        <h2 className={styles.title}>🎒 Oggetti</h2>
        <div className={styles.emptyStatePadded}>
          <p>Impossibile caricare l'inventario.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>🎒 Oggetti</h2>

      <h3 className={styles.sectionTitleLg}>👔 Equipaggiati</h3>
      <ItemGrid
        items={data?.equipped}
        isLoading={isLoading}
        emptyLabel="Nessun oggetto equipaggiato"
        canManage={canManage}
        characterId={character._id}
        onTransfer={setTransferItem}
      />

      <div className={styles.mtSection}>
        <h3 className={styles.sectionTitleLg}>🎒 Inventario</h3>
        <ItemGrid
          items={data?.unequipped}
          isLoading={isLoading}
          emptyLabel="Nessun oggetto in inventario"
          canManage={canManage}
          characterId={character._id}
          onTransfer={setTransferItem}
        />
      </div>

      {transferItem && (
        <TransferModal item={transferItem} characterId={character._id} onClose={() => setTransferItem(null)} />
      )}
    </div>
  );
}

function ItemGrid({
  items,
  isLoading,
  emptyLabel,
  canManage,
  characterId,
  onTransfer
}: {
  items: InventoryItemView[] | undefined;
  isLoading: boolean;
  emptyLabel: string;
  canManage: boolean;
  characterId: string;
  onTransfer: (item: InventoryItemView) => void;
}) {
  const setEquipped = useSetEquipped(characterId);
  const discardItem = useDiscardItem(characterId);

  if (isLoading) return <p className={styles.lockTextPlain}>Caricamento…</p>;

  if (!items || items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🎒</div>
        <p>{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className={styles.gridAuto250}>
      {items.map((item) => (
        <div key={item.inventoryItemId} className={styles.itemCard}>
          <div className={styles.itemHeader}>
            <h4 className={styles.itemName}>{item.name}</h4>
            {item.quantity > 1 && <span className={styles.qtyBadge}>×{item.quantity}</span>}
          </div>
          {item.description && <p className={styles.itemDesc}>{item.description}</p>}
          {canManage && (
            <div className={styles.actionButtonRow} style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => setEquipped.mutate({ inventoryItemId: item.inventoryItemId, equip: !item.isEquipped })}
                disabled={setEquipped.isPending}
              >
                {item.isEquipped ? '⬇️ Disequipaggia' : '⬆️ Equipaggia'}
              </button>
              <button type="button" className={styles.actionButton} onClick={() => onTransfer(item)}>
                🤝 Cedi
              </button>
              <button
                type="button"
                className={styles.actionButtonDanger}
                onClick={() => discardItem.mutate({ inventoryItemId: item.inventoryItemId })}
                disabled={discardItem.isPending}
              >
                🗑️ Butta
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TransferModal({ item, characterId, onClose }: { item: InventoryItemView; characterId: string; onClose: () => void }) {
  const { data } = usePublicCharacterList();
  const transferItem = useTransferItem(characterId);
  const [recipientId, setRecipientId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState('');

  const candidates = (data?.characters || []).filter(
    (c) => !c.isOwnCharacter && c.status === 'approved' && (!search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const handleSubmit = async () => {
    if (!recipientId) return;
    await transferItem.mutateAsync({ inventoryItemId: item.inventoryItemId, toCharacterId: recipientId, quantity });
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        className={styles.lockPanel}
        style={{ maxWidth: '420px', width: '90%', maxHeight: '480px', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
      <h3 className={styles.lockTitle}>Cedi "{item.name}"</h3>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Cerca personaggio destinatario</label>
        <input className={styles.formInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome…" />
      </div>

      <div className={styles.formField}>
        <select className={styles.formInput} value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
          <option value="">Seleziona…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {item.quantity > 1 && (
        <div className={styles.formField}>
          <label className={styles.formLabel}>Quantità (disponibili: {item.quantity})</label>
          <input
            className={styles.formInput}
            type="number"
            min={1}
            max={item.quantity}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(item.quantity, Number(e.target.value) || 1)))}
          />
        </div>
      )}

      <div className={styles.actionButtonRow} style={{ marginTop: '1rem', justifyContent: 'center' }}>
        <button type="button" className={styles.actionButton} onClick={handleSubmit} disabled={!recipientId || transferItem.isPending}>
          {transferItem.isPending ? 'Cessione…' : 'Conferma cessione'}
        </button>
        <button type="button" className={styles.actionButton} onClick={onClose}>
          Annulla
        </button>
      </div>
      </div>
    </div>
  );
}
