/**
 * Dice Roll Message Component
 *
 * Shows dice roll with large dice icon and result display.
 * System uses 1d100 percentile rolls.
 * Contains complete message structure with avatar, menu, content, and footer.
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
import { MessageAvatar } from '../MessageAvatar';
import { MessageEditableContent } from '../MessageEditableContent';
import { MessageFooter } from '../MessageFooter';
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

      {/* Left column: Avatar + Dice Icon + Name + Time */}
      <div className={styles.messageCardLeft}>
        <MessageAvatar
          avatar={message.characterAvatar}
          characterName={message.characterName}
          onClick={interactions.handleAvatarClick}
        />
        <span className={styles.characterName}>{message.characterName}</span>
        <span className={styles.diceIcon}>🎲</span>
        <time className={styles.messageTimestamp}>{interactions.formattedTime}</time>
      </div>

      {/* Right column: Content + Menu + Tag */}
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
            <>
              {message.content && <div className={styles.messageContent}>{message.content}</div>}
              {/* Dice roll result: Multi-dice system */}
              {diceRoll && (
                <div className={styles.diceRollResult}>
                  {/* Formula */}
                  {diceRoll.dice && (
                    <div className={styles.diceFormula}>{diceRoll.dice}</div>
                  )}

                  {/* Individual rolls (if multiple dice) */}
                  {diceRoll.rolls && diceRoll.rolls.length > 1 && (
                    <div className={styles.diceRolls}>
                      [{diceRoll.rolls.join(', ')}]
                    </div>
                  )}

                  {/* Breakdown (if modifier exists) */}
                  {diceRoll.modifier !== undefined && diceRoll.modifier !== 0 && (
                    <div className={styles.diceBreakdown}>
                      {diceRoll.result} {diceRoll.modifier >= 0 ? '+' : ''}{diceRoll.modifier}
                    </div>
                  )}

                  {/* Final total */}
                  <div className={styles.diceTotal}>
                    {diceRoll.total !== undefined ? diceRoll.total : diceRoll.result}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <MessageFooter message={message} onTagClick={interactions.handleTagClick} />
      </div>
    </>
  );
}
