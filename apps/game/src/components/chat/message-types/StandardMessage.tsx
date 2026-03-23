/**
 * Standard Message Component
 *
 * Default message type for in-character actions and dialogue.
 * Contains complete message structure with avatar, menu, content, and footer.
 * Uses useMessageInteractions hook for shared logic.
 *
 * @module components/chat/message-types/StandardMessage
 * @since 2.0.0
 */

'use client';

import { useMessageInteractions } from '@/hooks/useMessageInteractions';
import styles from '@/styles/components/chat/message-types/StandardMessage.module.scss';
import type { ChatMessage } from '@/types/chat';

import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import { MessageEditableContent } from '../MessageEditableContent';
import { MessageFooter } from '../MessageFooter';
import { MessageMenu } from '../MessageMenu';


interface StandardMessageProps {
  message: ChatMessage;
  currentCharacterId: string;
}

export function StandardMessage({ message, currentCharacterId }: StandardMessageProps): JSX.Element {
  const interactions = useMessageInteractions(message, currentCharacterId);

  return (
    <>
      <ConfirmDeleteDialog
        isOpen={interactions.showDeleteDialog}
        onConfirm={interactions.handleConfirmDelete}
        onCancel={interactions.handleCancelDelete}
      />

      {/* Left column: Avatar + Name + Time */}
      <div className={styles.messageCardLeft}>
        <button
          className={`${styles.messageAvatar} ${message.isMasked ? styles.avatarDisabled : ''}`}
          onClick={interactions.handleAvatarClick}
          type="button"
          aria-label={message.isMasked ? 'Identità nascosta' : `Apri scheda di ${message.characterName}`}
          disabled={message.isMasked}
          title={message.isMasked ? 'Identità nascosta (PNG Light)' : undefined}
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
