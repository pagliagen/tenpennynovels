/**
 * Combat Action Message Component
 *
 * Shows the result of a resolved confrontation (combat or social).
 * Displays opposed roll with attack vs defense, success levels, and outcome.
 *
 * @module components/chat/message-types/CombatActionMessage
 * @since 2.0.0 (TiroContrapposto Phase 1)
 */

'use client';

import type { ChatMessage } from '@/types/chat';
import { useMessageInteractions } from '@/hooks/useMessageInteractions';
import { MessageMenu } from '../MessageMenu';
import { MessageEditableContent } from '../MessageEditableContent';
import { MessageFooter } from '../MessageFooter';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import styles from '@/styles/components/chat/message-types/CombatActionMessage.module.scss';

interface CombatActionMessageProps {
  message: ChatMessage;
  currentCharacterId: string;
}

export function CombatActionMessage({ message, currentCharacterId }: CombatActionMessageProps): JSX.Element {
  const interactions = useMessageInteractions(message, currentCharacterId);
  const confrontation = message.confrontation;

  // Map success levels to Italian labels
  const degreeLabels: Record<string, string> = {
    critical: 'Critico',
    extreme: 'Estremo',
    hard: 'Difficile',
    normal: 'Normale',
    failure: 'Fallimento',
    fumble: 'Fallimento Critico'
  };

  // Map outcomes to Italian labels
  const outcomeLabels: Record<string, string> = {
    hit: 'Colpito!',
    miss: 'Mancato!',
    parry: 'Parato!',
    dodge: 'Schivato!',
    disarm: 'Disarmato!',
    attacker_wins: 'Attaccante vince!',
    defender_wins: 'Difensore vince!',
    draw: 'Pareggio!'
  };

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
        <time className={styles.messageTimestamp}>{interactions.formattedTime}</time>
      </div>

      {/* Right column: Content + Menu + Confrontation Result */}
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
              {message.content && <div className={styles.messageContent}>{message.content}</div>}

              {/* Confrontation result display */}
              {confrontation && confrontation.phase === 'result' && (
                <div className={styles.confrontationResult}>
                  {/* Opposed roll display */}
                  <div className={styles.opposedRoll}>
                    {/* Attacker side */}
                    <div className={styles.rollSide}>
                      <div className={styles.skillName}>{confrontation.attackSkill}</div>
                      <div className={styles.rollValue}>{confrontation.attackRoll}</div>
                      <div className={styles.degree}>
                        {confrontation.attackSuccessLevel && degreeLabels[confrontation.attackSuccessLevel]}
                      </div>
                    </div>

                    {/* VS divider */}
                    <div className={styles.versus}>VS</div>

                    {/* Defender side */}
                    <div className={styles.rollSide}>
                      <div className={styles.skillName}>{confrontation.defenseSkill}</div>
                      <div className={styles.rollValue}>{confrontation.defenseRoll}</div>
                      <div className={styles.degree}>
                        {confrontation.defenseSuccessLevel && degreeLabels[confrontation.defenseSuccessLevel]}
                      </div>
                    </div>
                  </div>

                  {/* Outcome */}
                  {confrontation.outcome && (
                    <div className={`${styles.outcome} ${styles[`outcome_${confrontation.outcome}`]}`}>
                      {outcomeLabels[confrontation.outcome] || confrontation.outcome}
                    </div>
                  )}
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
