/**
 * Defender Notification Component
 *
 * Shows notification when defender detects deception (failed Raggirare).
 * Only visible to defender and master.
 * Features special notification-style layout.
 * Uses useMessageInteractions hook for shared logic.
 *
 * @module components/chat/message-types/DefenderNotification
 * @since 2.0.0
 */

'use client';

import type { ChatMessage } from '@/types/chat';
import { useMessageInteractions } from '@/hooks/useMessageInteractions';
import { MessageMenu } from '../MessageMenu';
import { MessageFooter } from '../MessageFooter';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import styles from '@/styles/components/chat/message-types/DefenderNotification.module.scss';

interface DefenderNotificationProps {
  message: ChatMessage;
  currentCharacterId: string;
}

export function DefenderNotification({ message, currentCharacterId }: DefenderNotificationProps): JSX.Element {
  const interactions = useMessageInteractions(message, currentCharacterId);
  const skillCheck = message.socialConflict as any; // TODO: Update type after Phase 6

  return (
    <>
      <ConfirmDeleteDialog
        isOpen={interactions.showDeleteDialog}
        onConfirm={interactions.handleConfirmDelete}
        onCancel={interactions.handleCancelDelete}
      />

      <div className={styles.defenderNotification}>
        {/* Menu button (positioned absolutely) */}
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

        <div className={styles.notificationHeader}>
          <span className={styles.warningIcon}>⚠️</span>
          <strong>You sense something's wrong</strong>
          <time className={styles.messageTimestamp}>{interactions.formattedTime}</time>
        </div>

        <div className={styles.notificationContent}>
          <p className={styles.notificationText}>
            You notice <strong>{message.characterName}</strong> is being deceptive.
          </p>

          {skillCheck && skillCheck.attackSkill && skillCheck.defenseSkill && (
            <p className={styles.notificationDetails}>
              Your <strong>{skillCheck.defenseSkill}</strong> ({skillCheck.defenseDegree})
              detected their <strong>{skillCheck.attackSkill}</strong> ({skillCheck.attackDegree}).
            </p>
          )}

          {/* Show visible action text (what they said) */}
          {message.content && (
            <div className={styles.suspiciousAction}>
              <span className={styles.label}>What they said:</span>
              <p>"{message.content}"</p>
            </div>
          )}

          <div className={styles.notificationFooter}>
            💡 You don't know what they're hiding, but something feels off.
          </div>
        </div>

        {/* Footer with tag */}
        <MessageFooter message={message} onTagClick={interactions.handleTagClick} />
      </div>
    </>
  );
}
