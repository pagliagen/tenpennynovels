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

import { useMessageInteractions } from '@/hooks/useMessageInteractions';
import styles from '@/styles/components/chat/message-types/WhisperMessage.module.scss';
import type { ChatMessage } from '@/types/chat';

import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import { MessageAvatar } from '../MessageAvatar';
import { MessageContent } from '../MessageContent';
import { MessageEditableContent } from '../MessageEditableContent';
import { MessageFooter } from '../MessageFooter';
import { MessageMenu } from '../MessageMenu';


interface WhisperMessageProps {
  message: ChatMessage;
  currentCharacterId: string;
}

export function WhisperMessage({ message, currentCharacterId }: WhisperMessageProps): JSX.Element {
  const interactions = useMessageInteractions(message, currentCharacterId);

  // Extract target from targetCharacters (DB field)
  // Intentionally shows "(privato)" for privacy - master can see in full message
  const targetName = message.targetCharacters && message.targetCharacters.length > 0
    ? '(privato)'
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
        <MessageAvatar
          avatar={message.characterAvatar}
          characterName={message.characterName}
          onClick={interactions.handleAvatarClick}
        />
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
            <div className={styles.messageContent}>
              <MessageContent content={message.content} />
            </div>
          )}
        </div>

        {/* Footer */}
        <MessageFooter message={message} onTagClick={interactions.handleTagClick} />
      </div>
    </>
  );
}
