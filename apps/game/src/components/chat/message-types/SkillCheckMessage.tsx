/**
 * Skill Check Message Component
 *
 * Shows social conflict / skill check result with opposed roll visualization.
 * Displays attacker vs defender skills, rolls, and margin of success/failure.
 * Contains complete message structure with avatar, menu, content, and footer.
 * Uses useMessageInteractions hook for shared logic.
 *
 * @module components/chat/message-types/SkillCheckMessage
 * @since 2.0.0
 */

'use client';

import type { ChatMessage } from '@/types/chat';
import { useMessageInteractions } from '@/hooks/useMessageInteractions';
import { MessageMenu } from '../MessageMenu';
import { MessageEditableContent } from '../MessageEditableContent';
import { MessageFooter } from '../MessageFooter';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import styles from '@/styles/components/chat/message-types/SkillCheckMessage.module.scss';

interface SkillCheckMessageProps {
  message: ChatMessage;
  currentCharacterId: string;
}

export function SkillCheckMessage({ message, currentCharacterId }: SkillCheckMessageProps): JSX.Element {
  const interactions = useMessageInteractions(message, currentCharacterId);
  const skillCheck = message.socialConflict as any; // TODO: Update SkillCheckPayload type after Phase 6
  const diceResult = message.diceResult;

  return (
    <>
      <ConfirmDeleteDialog
        isOpen={interactions.showDeleteDialog}
        onConfirm={interactions.handleConfirmDelete}
        onCancel={interactions.handleCancelDelete}
      />

      {/* Left column: Avatar + Skill Icon + Name + Time */}
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
        <span className={styles.skillIcon}>⚔️</span>
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

              {/* Opposed Roll Visualization (Social Conflicts) */}
              {skillCheck && skillCheck.attackSkill && skillCheck.defenseSkill && (
                <div className={styles.socialConflictResult}>
                  <div className={styles.opposedRoll}>
                    {/* Attacker */}
                    <div className={styles.rollSide}>
                      <strong className={styles.skillName}>{skillCheck.attackSkill}</strong>
                      <span className={styles.rollValue}>{skillCheck.attackRoll}</span>
                      <span className={styles.degree}>{skillCheck.attackDegree}</span>
                    </div>

                    {/* VS */}
                    <span className={styles.versus}>VS</span>

                    {/* Defender */}
                    <div className={styles.rollSide}>
                      <strong className={styles.skillName}>{skillCheck.defenseSkill}</strong>
                      <span className={styles.rollValue}>{skillCheck.defenseRoll}</span>
                      <span className={styles.degree}>{skillCheck.defenseDegree}</span>
                    </div>
                  </div>

                  {/* Outcome */}
                  <div className={styles.outcome}>
                    {skillCheck.isSuccess ? (
                      <span className={styles.success}>✅ Success (margin: +{skillCheck.margin})</span>
                    ) : (
                      <span className={styles.failure}>❌ Failure (margin: {skillCheck.margin})</span>
                    )}
                  </div>

                  {/* Hidden Intent (only visible to attacker and master) */}
                  {(message as any).hiddenContent && (
                    <div className={styles.hiddenIntent}>
                      <span className={styles.label}>🔒 True Intent (master only):</span>
                      <p>{(message as any).hiddenContent}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Simple skill check (non-opposed) - shows dice result */}
              {!skillCheck && diceResult && (diceResult as any).skillName && (
                <div className={styles.skillCheckResult}>
                  <div className={styles.rollDisplay}>
                    <span className={styles.rollValue}>🎲 {diceResult.result}</span>
                    <span className={styles.successDegree}>
                      {(diceResult as any).successDegree || (diceResult.success ? 'Successo' : 'Fallimento')}
                    </span>
                  </div>
                </div>
              )}

              {/* Fallback for old-style skill check (non-opposed) */}
              {skillCheck && !skillCheck.attackSkill && skillCheck.skill && (
                <div className={styles.skillCheckResult}>
                  Skill: {skillCheck.skill} | Success: {skillCheck.success ? '✅' : '❌'}
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
