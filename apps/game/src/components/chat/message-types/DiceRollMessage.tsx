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

import type { ChatMessage } from '@/types/chat';
import { useMessageInteractions } from '@/hooks/useMessageInteractions';
import { MessageMenu } from '../MessageMenu';
import { MessageEditableContent } from '../MessageEditableContent';
import { MessageFooter } from '../MessageFooter';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import styles from '@/styles/components/chat/message-types/DiceRollMessage.module.scss';

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
        <button
          className={styles.messageAvatar}
          onClick={interactions.handleAvatarClick}
          type="button"
          aria-label={`Apri scheda di ${message.characterName}`}
        >
          {message.characterAvatar ? (
            <img src={message.characterAvatar} alt="" />
          ) : (
            <span className={styles.avatarPlaceholder}>
              {message.characterName?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </button>
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
              {/* Dice roll result: Sistema percentuale 1d100 */}
              {diceRoll && (
                <div className={styles.diceRollResult}>
                  <span className={styles.diceTotal}>{diceRoll.result}/100</span>
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
