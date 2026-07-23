/**
 * Master Message Component
 *
 * Special announcement from game master.
 * Features gold-themed styling with star prefix and enhanced visibility.
 * Contains complete message structure with avatar, menu, content, and footer.
 * Uses useMessageInteractions hook for shared logic.
 *
 * @module components/chat/message-types/MasterMessage
 * @since 2.0.0
 */

'use client';

import { useMessageInteractions } from '@/hooks/useMessageInteractions';
import styles from '@/styles/components/chat/message-types/MasterMessage.module.scss';
import type { ChatMessage } from '@/types/chat';

import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import { MessageContent } from '../MessageContent';
import { MessageEditableContent } from '../MessageEditableContent';
import { MessageFooter } from '../MessageFooter';
import { MessageMenu } from '../MessageMenu';


interface MasterMessageProps {
  message: ChatMessage;
  currentCharacterId: string;
}

export function MasterMessage({ message, currentCharacterId }: MasterMessageProps): JSX.Element {
  const interactions = useMessageInteractions(message, currentCharacterId);

  return (
    <>
      <ConfirmDeleteDialog
        isOpen={interactions.showDeleteDialog}
        onConfirm={interactions.handleConfirmDelete}
        onCancel={interactions.handleCancelDelete}
      />

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
              <div className={styles.messageTimestampContainer}>
                <span className={styles.characterName}>{message.characterName}</span>
                <time className={styles.messageTimestamp}>{interactions.formattedTime}</time>
              </div>
              <MessageContent content={message.content} mentionVariant="master" />
            </div>
          )}
        </div>

        {/* Footer */}
        <MessageFooter message={message} onTagClick={interactions.handleTagClick} />
      </div>
    </>
  );
}
