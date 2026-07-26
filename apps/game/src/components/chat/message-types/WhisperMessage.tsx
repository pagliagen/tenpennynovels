/**
 * Whisper Message Component
 *
 * Private message visible only to sender, target(s), and masters.
 * No avatar column — instead a header line renders
 * "Sender sussurra a Target1, Target2: " with each name a link to its
 * character sheet, matching how the mention parser links names inline.
 * Uses useMessageInteractions hook for shared logic.
 *
 * @module components/chat/message-types/WhisperMessage
 * @since 2.0.0
 */

'use client';

import { useWindowManagerStore } from '@/store/windowManagerStore';
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
  const openWindow = useWindowManagerStore((state) => state.openWindow);

  const targetIds = message.whisper?.targetCharacterIds ?? [];
  const targetNames = message.whisper?.targetCharacterNames ?? [];

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
              <p className={styles.whisperHeader}>
                {message.isMasked ? (
                  <span className={styles.whisperName}>{message.characterName}</span>
                ) : (
                  <button
                    type="button"
                    className={styles.whisperNameLink}
                    onClick={interactions.handleAvatarClick}
                  >
                    {message.characterName}
                  </button>
                )}
                {' sussurra'}
                {targetIds.length > 0 && (
                  <>
                    {' a '}
                    {targetIds.map((id, i) => (
                      <span key={id}>
                        <button
                          type="button"
                          className={styles.whisperNameLink}
                          onClick={() =>
                            openWindow('characterSheet', {
                              characterId: id,
                              characterName: targetNames[i],
                              avatar: undefined,
                            })
                          }
                        >
                          {targetNames[i] ?? 'Sconosciuto'}
                        </button>
                        {i < targetIds.length - 1 && (i === targetIds.length - 2 ? ' e ' : ', ')}
                      </span>
                    ))}
                  </>
                )}
                {': '}
              </p>
              <MessageContent content={message.content} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
