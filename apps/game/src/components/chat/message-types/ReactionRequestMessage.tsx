/**
 * Reaction Request Message Component
 *
 * Shows a confrontation attack waiting for defender's reaction.
 * Defender sees multiple defense skill buttons to choose from.
 * Attacker sees a "waiting for reaction" status.
 *
 * @module components/chat/message-types/ReactionRequestMessage
 * @since 2.0.0 (TiroContrapposto Phase 1)
 */

'use client';

import { useState } from 'react';

import { useMessageInteractions } from '@/hooks/useMessageInteractions';
import { locationChatsApi } from '@/lib/api/locationChats';
import { useUIStore } from '@/store/uiStore';
import styles from '@/styles/components/chat/message-types/ReactionRequestMessage.module.scss';
import type { ChatMessage } from '@/types/chat';

import { MessageFooter } from '../MessageFooter';

interface ReactionRequestMessageProps {
  message: ChatMessage;
  currentCharacterId: string;
}

export function ReactionRequestMessage({ message, currentCharacterId }: ReactionRequestMessageProps): JSX.Element {
  const interactions = useMessageInteractions(message, currentCharacterId);
  const { addToast } = useUIStore();
  const [choosing, setChoosing] = useState(false);

  const confrontation = message.confrontation;
  const isDefender = confrontation?.defenderCharacterId === currentCharacterId;
  const showButtons = isDefender && confrontation?.phase === 'waiting_reaction';

  const handleChooseDefense = async (defenseSkill: string) => {
    setChoosing(true);
    try {
      await locationChatsApi.reactToConfrontation(message._id, defenseSkill);
      // Message will be updated via WebSocket, no need to manually update
    } catch (error: any) {
      console.error('Error choosing defense:', error);
      addToast({
        type: 'error',
        message: error.message || 'Errore nella scelta della difesa'
      });
      setChoosing(false);
    }
  };

  return (
    <>
      {/* Left column: Icon + Name + Time */}
      <div className={styles.messageCardLeft}>
        <span className={styles.confrontationIcon}>⚔️</span>
        <span className={styles.characterName}>{message.characterName}</span>
        <time className={styles.messageTimestamp}>{interactions.formattedTime}</time>
      </div>

      {/* Right column: Content + Defense Buttons */}
      <div className={styles.messageCardRight}>
        <div className={styles.messageContent}>{message.content}</div>

        {/* Defense skill selection (defender only) */}
        {showButtons && confrontation.availableDefenseSkills && (
          <div className={styles.defenseButtons}>
            <p className={styles.defensePrompt}>Scegli la tua difesa:</p>
            <div className={styles.buttonGrid}>
              {confrontation.availableDefenseSkills.map(skill => (
                <button
                  key={skill.skillName}
                  onClick={() => handleChooseDefense(skill.skillName)}
                  disabled={choosing}
                  className={`${styles.defenseButton} ${skill.specialRule === 'auto_fail' ? styles.autoFailButton : ''}`}
                  type="button"
                >
                  {skill.label}
                  {skill.specialRule && skill.specialRule !== 'auto_fail' && (
                    <span className={styles.specialRule}>{skill.specialRule}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Waiting status (attacker or observers) */}
        {!isDefender && confrontation?.phase === 'waiting_reaction' && (
          <p className={styles.waitingStatus}>In attesa della scelta del difensore...</p>
        )}

        {/* Footer */}
        <MessageFooter message={message} onTagClick={interactions.handleTagClick} />
      </div>
    </>
  );
}
