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

import type { ChatMessage } from '@/types/chat';
import { useMessageInteractions } from '@/hooks/useMessageInteractions';
import { MessageMenu } from '../MessageMenu';
import { MessageEditableContent } from '../MessageEditableContent';
import { MessageFooter } from '../MessageFooter';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import styles from '@/styles/components/chat/message-types/StatCheckMessage.module.scss';

interface StatCheckMessageProps {
  message: ChatMessage;
  currentCharacterId: string;
}

export function StatCheckMessage({ message, currentCharacterId }: StatCheckMessageProps): JSX.Element {
  const interactions = useMessageInteractions(message, currentCharacterId);
  const statCheck = message.statCheck;

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
              {statCheck && (
                <div className={styles.statCheckResult}>
                  {statCheck.attribute} ({statCheck.difficulty}) | Roll: {statCheck.roll} vs {statCheck.target} | {statCheck.success ? '✅' : '❌'}
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
