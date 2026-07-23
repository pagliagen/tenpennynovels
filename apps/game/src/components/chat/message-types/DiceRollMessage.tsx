/**
 * Dice Roll Message Component
 *
 * Shows dice roll with result display.
 * System uses 1d100 percentile rolls.
 * Compact layout: no avatar/header/footer, just content and menu (dice icon via CSS).
 * Uses useMessageInteractions hook for shared logic.
 *
 * @module components/chat/message-types/DiceRollMessage
 * @since 2.0.0
 */

'use client';

import { useMessageInteractions } from '@/hooks/useMessageInteractions';
import styles from '@/styles/components/chat/message-types/DiceRollMessage.module.scss';
import type { ChatMessage } from '@/types/chat';

import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import { MessageEditableContent } from '../MessageEditableContent';
import { MessageMenu } from '../MessageMenu';


interface DiceRollMessageProps {
  message: ChatMessage;
  currentCharacterId: string;
}

export function DiceRollMessage({ message, currentCharacterId }: DiceRollMessageProps): JSX.Element {
  const interactions = useMessageInteractions(message, currentCharacterId);
  const diceRoll = message.diceResult;

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
              {/* Dice roll result: Multi-dice system */}
              {diceRoll && (
                <div className={styles.diceResultContainer}>
                  <span className={styles.textContent}>{message.content}</span>

                  {/* Individual rolls (if multiple dice) */}
                  {diceRoll.rolls && diceRoll.rolls.length > 1 && (
                    <span className={styles.diceRolls}>
                      [{diceRoll.rolls.join(', ')}]:
                    </span>
                  )}

                  {/* Breakdown (if modifier exists) */}
                  {diceRoll.modifier !== undefined && diceRoll.modifier !== 0 && (
                    <span className={styles.diceBreakdown}>
                      {diceRoll.result} {diceRoll.modifier >= 0 ? '+' : ''}{diceRoll.modifier}
                    </span>
                  )}

                  {/* Final total */}
                  <span className={styles.diceTotal}>
                    {diceRoll.total !== undefined ? diceRoll.total : diceRoll.result}
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
