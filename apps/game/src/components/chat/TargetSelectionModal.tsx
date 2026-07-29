/**
 * Target Selection Modal
 *
 * Popup shown when the user clicks "Invia" for an action that needs a
 * target picked at send-time (whisper recipient, item to use, or the
 * optional "esito riservato" targets for a master announcement).
 *
 * @module components/chat/TargetSelectionModal
 * @since 2.1.0
 */

'use client';

import { useEffect } from 'react';

import styles from '@/styles/components/chat/TargetSelectionModal.module.scss';

interface Occupant {
  characterId: string;
  characterName: string;
}

interface Item {
  id: string;
  name: string;
  category?: string;
}

interface TargetSelectionModalProps {
  /** Which action triggered this popup */
  actionType: 'whisper' | 'item_use' | 'master';

  /** Location occupants (whisper recipient / master reserved targets) */
  occupants: Occupant[];

  /** Current character ID (excluded from target lists) */
  currentCharacterId: string;

  /** Character equipped items (item_use only) */
  equippedItems?: Item[];

  /** Selected target character(s) */
  targetCharacters: string[];

  /** Selected item (item_use only) */
  selectedItem: string;

  onTargetChange: (targets: string[]) => void;
  onItemChange: (item: string) => void;

  /** Confirm and actually send the message */
  onConfirm: () => void;

  /** Close without sending */
  onClose: () => void;
}

const TITLES: Record<TargetSelectionModalProps['actionType'], string> = {
  whisper: 'Seleziona Destinatario',
  item_use: 'Seleziona Oggetto',
  master: 'Esito Riservato',
};

/**
 * Target Selection Modal Component
 *
 * @param {TargetSelectionModalProps} props - Component props
 * @returns {JSX.Element} Send-time target picker
 */
export function TargetSelectionModal({
  actionType,
  occupants,
  currentCharacterId,
  equippedItems = [],
  targetCharacters,
  selectedItem,
  onTargetChange,
  onItemChange,
  onConfirm,
  onClose,
}: TargetSelectionModalProps): JSX.Element {
  const otherOccupants = occupants.filter((occ) => occ.characterId !== currentCharacterId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleMasterTarget = (characterId: string) => {
    if (targetCharacters.includes(characterId)) {
      onTargetChange(targetCharacters.filter((id) => id !== characterId));
    } else {
      onTargetChange([...targetCharacters, characterId]);
    }
  };

  const isConfirmDisabled =
    (actionType === 'whisper' && (otherOccupants.length === 0 || targetCharacters.length === 0)) ||
    (actionType === 'item_use' && (equippedItems.length === 0 || !selectedItem));

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{TITLES[actionType]}</h3>

        {actionType === 'whisper' && (
          otherOccupants.length === 0 ? (
            <p className={styles.emptyState}>Nessun altro personaggio presente per un sussurro.</p>
          ) : (
            <select
              value={targetCharacters[0] || ''}
              onChange={(e) => onTargetChange(e.target.value ? [e.target.value] : [])}
              className={styles.selectInput}
              autoFocus
            >
              <option value="">Seleziona Destinatario</option>
              {otherOccupants.map((occupant) => (
                <option key={occupant.characterId} value={occupant.characterId}>
                  {occupant.characterName}
                </option>
              ))}
            </select>
          )
        )}

        {actionType === 'item_use' && (
          equippedItems.length === 0 ? (
            <p className={styles.emptyState}>Nessun oggetto equipaggiato.</p>
          ) : (
            <select
              value={selectedItem}
              onChange={(e) => onItemChange(e.target.value)}
              className={styles.selectInput}
              autoFocus
            >
              <option value="">Seleziona Oggetto</option>
              {equippedItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} {item.category && `(${item.category})`}
                </option>
              ))}
            </select>
          )
        )}

        {actionType === 'master' && (
          otherOccupants.length === 0 ? (
            <p className={styles.emptyState}>Nessun altro personaggio a cui riservare l&apos;esito: sarà visibile a tutti.</p>
          ) : (
            <>
              <p className={styles.masterTargetLabel}>
                {targetCharacters.length === 0
                  ? 'Visibile a tutti (default) — seleziona per rendere l\'esito riservato:'
                  : `Riservato a ${targetCharacters.length} personaggi + master:`}
              </p>
              <div className={styles.masterTargetPicker}>
                {otherOccupants.map((occupant) => (
                  <label key={occupant.characterId} className={styles.masterTargetOption}>
                    <input
                      type="checkbox"
                      checked={targetCharacters.includes(occupant.characterId)}
                      onChange={() => toggleMasterTarget(occupant.characterId)}
                    />
                    {occupant.characterName}
                  </label>
                ))}
              </div>
            </>
          )
        )}

        <div className={styles.actions}>
          <button onClick={onClose} className={styles.cancelButton}>
            Annulla
          </button>
          <button onClick={onConfirm} disabled={isConfirmDisabled} className={styles.confirmButton}>
            {actionType === 'master' ? 'Invia' : 'Conferma e Invia'}
          </button>
        </div>
      </div>
    </div>
  );
}
