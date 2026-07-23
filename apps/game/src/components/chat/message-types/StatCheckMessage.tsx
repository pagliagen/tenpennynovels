/**
 * Stat Check Message Component
 *
 * Shows attribute check result (Strength, Dexterity, etc.).
 * Displays attribute, difficulty, roll vs target, and success/failure.
 * Compact layout: no avatar/header/footer, just content and menu.
 * Uses useMessageInteractions hook for shared logic.
 *
 * @module components/chat/message-types/StatCheckMessage
 * @since 2.0.0
 */

'use client';

import { useMessageInteractions } from '@/hooks/useMessageInteractions';
import styles from '@/styles/components/chat/message-types/StatCheckMessage.module.scss';
import type { ChatMessage } from '@/types/chat';

import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import { MessageEditableContent } from '../MessageEditableContent';
import { MessageMenu } from '../MessageMenu';


interface StatCheckMessageProps {
  message: ChatMessage;
  currentCharacterId: string;
}

export function StatCheckMessage({ message, currentCharacterId }: StatCheckMessageProps): JSX.Element {
  const interactions = useMessageInteractions(message, currentCharacterId);
  const diceResult = message.diceResult;

  return (
    <>
      <ConfirmDeleteDialog
        isOpen={interactions.showDeleteDialog}
        onConfirm={interactions.handleConfirmDelete}
        onCancel={interactions.handleCancelDelete}
      />

      {/* Content + Menu */}
      <div className={styles.messageCardRight}>
        {/* Menu button */}
        {interactions.canEdit && (
          <div className={styles.messageHeaderActions}>
            <button
              className={styles.messageMenuButton}
              onClick={interactions.handleMenuToggle}
              data-menu-button
              type="button"
              aria-label="Opzioni messaggio"
              aria-expanded={interactions.menuOpen}
            >
              ⋮
            </button>
            {interactions.menuOpen && (
              <MessageMenu
                ref={interactions.menuRef}
                isEditing={interactions.isEditing}
                onEdit={interactions.handleEdit}
                onSaveEdit={interactions.handleSaveEdit}
                onCancelEdit={interactions.handleCancelEdit}
                onDelete={interactions.handleDelete}
              />
            )}
          </div>
        )}

        {/* Content */}
        <div className={styles.messageCardContent}>
          {interactions.isEditing ? (
            <MessageEditableContent
              content={interactions.editedContent}
              onChange={interactions.setEditedContent}
            />
          ) : (
            <div className={styles.messageContent}>
              {message.content}
              {diceResult && (
                <div className={styles.diceResultContainer}>
                  <span className={styles.rollValue}>🎲 {diceResult.result}</span>
                  <span className={styles.successDegree}>
                    {diceResult.successDegree || (diceResult.success ? 'Successo' : 'Fallimento')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
