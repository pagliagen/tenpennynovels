/**
 * Whisper Message Component
 *
 * Private message visible only to sender, target, and masters.
 * Compact layout: no avatar/header/footer, just content and menu (whisper icon via CSS).
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
import { MessageContent } from '../MessageContent';
import { MessageEditableContent } from '../MessageEditableContent';
import { MessageMenu } from '../MessageMenu';


interface WhisperMessageProps {
  message: ChatMessage;
  currentCharacterId: string;
}

export function WhisperMessage({ message, currentCharacterId }: WhisperMessageProps): JSX.Element {
  const interactions = useMessageInteractions(message, currentCharacterId);

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
              <MessageContent content={message.content} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
