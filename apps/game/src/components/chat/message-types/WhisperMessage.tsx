/**
 * Whisper Message Component
 *
 * Private message visible only to sender, target, and masters.
 * Features brown-themed styling with lock icon indicator.
 * Contains complete message structure with avatar, menu, content, and footer.
 * Uses useMessageInteractions hook for shared logic.
 *
 * @module components/chat/message-types/WhisperMessage
 * @since 2.0.0
 */

'use client';

import type { ChatMessage } from '@/types/chat';
import { useMessageInteractions } from '@/hooks/useMessageInteractions';
import { MessageMenu } from '../MessageMenu';
import { MessageEditableContent } from '../MessageEditableContent';
import { MessageFooter } from '../MessageFooter';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import styles from '@/styles/components/chat/message-types/WhisperMessage.module.scss';

interface WhisperMessageProps {
  message: ChatMessage;
  currentCharacterId: string;
}

export function WhisperMessage({ message, currentCharacterId }: WhisperMessageProps): JSX.Element {
  const interactions = useMessageInteractions(message, currentCharacterId);

  // Extract target from targetCharacters (DB field)
  const targetName = message.targetCharacters && message.targetCharacters.length > 0
    ? '(privato)' // TODO: Fetch target character name if needed
    : '(privato)';

  return (
    <>
      <ConfirmDeleteDialog
        isOpen={interactions.showDeleteDialog}
        onConfirm={interactions.handleConfirmDelete}
        onCancel={interactions.handleCancelDelete}
      />

      {/* Left column: Avatar + Name + Whisper Badge + Time */}
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
        <span className={styles.whisperBadge}>🔒 {targetName}</span>
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
            <div className={styles.messageContent}>{message.content}</div>
          )}
        </div>

        {/* Footer */}
        <MessageFooter message={message} onTagClick={interactions.handleTagClick} />
      </div>
    </>
  );
}
