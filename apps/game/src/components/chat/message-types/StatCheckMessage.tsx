/**
 * Stat Check Message Component
 *
 * Shows attribute check result (Strength, Dexterity, etc.).
 * Displays attribute, difficulty, roll vs target, and success/failure.
 * Contains complete message structure with avatar, menu, content, and footer.
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
import { MessageFooter } from '../MessageFooter';
import { MessageMenu } from '../MessageMenu';


interface StatCheckMessageProps {
  message: ChatMessage;
  currentCharacterId: string;
}

export function StatCheckMessage({ message, currentCharacterId }: StatCheckMessageProps): JSX.Element {
  const interactions = useMessageInteractions(message, currentCharacterId);
  const statCheck = message.statCheck;
  const diceResult = message.diceResult;

  return (
    <>
      <ConfirmDeleteDialog
        isOpen={interactions.showDeleteDialog}
        onConfirm={interactions.handleConfirmDelete}
        onCancel={interactions.handleCancelDelete}
      />

      {/* Left column: Avatar + Stat Icon + Name + Time */}
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
        <span className={styles.statIcon}>💪</span>
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
              <div className={styles.messageContent}>{message.content}</div>

              {/* Stat check from diceResult (new format - no target exposed) */}
              {diceResult && (diceResult as any).statName && (
                <div className={styles.statCheckResult}>
                  <div className={styles.rollDisplay}>
                    <span className={styles.rollValue}>🎲 {diceResult.result}</span>
                    <span className={styles.successDegree}>
                      {(diceResult as any).successDegree || (diceResult.success ? 'Successo' : 'Fallimento')}
                    </span>
                  </div>
                </div>
              )}

              {/* Legacy stat check (old format with target - should not happen anymore) */}
              {!diceResult && statCheck && (
                <div className={styles.statCheckResult}>
                  Roll: {statCheck.roll} | {statCheck.success ? '✅' : '❌'}
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
