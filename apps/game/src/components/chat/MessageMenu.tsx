/**
 * MessageMenu
 *
 * Context menu with dynamic states:
 * - Normal: Modifica / Cancella
 * - Editing: Salva / Annulla
 */

import { forwardRef } from 'react';
import styles from '@/styles/components/chat/MessageMenu.module.scss';

interface MessageMenuProps {
  isEditing: boolean;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}

export const MessageMenu = forwardRef<HTMLDivElement, MessageMenuProps>(
  (
    {
      isEditing,
      onEdit,
      onSaveEdit,
      onCancelEdit,
      onDelete,
    },
    ref
  ) => {
    return (
      <div ref={ref} className={styles.messageMenu} role="menu">
        {isEditing ? (
          // Edit mode: Salva / Annulla
          <>
            <button
              className={styles.messageMenuItem}
              onClick={onSaveEdit}
              type="button"
              role="menuitem"
            >
              Salva
            </button>
            <button
              className={styles.messageMenuItem}
              onClick={onCancelEdit}
              type="button"
              role="menuitem"
            >
              Annulla
            </button>
          </>
        ) : (
          // Normal mode: Modifica / Cancella
          <>
            <button
              className={styles.messageMenuItem}
              onClick={onEdit}
              type="button"
              role="menuitem"
            >
              Modifica
            </button>
            <button
              className={styles.messageMenuItem}
              onClick={onDelete}
              type="button"
              role="menuitem"
            >
              Cancella
            </button>
          </>
        )}
      </div>
    );
  }
);

MessageMenu.displayName = 'MessageMenu';
