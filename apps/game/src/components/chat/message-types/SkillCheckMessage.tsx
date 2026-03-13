/**
 * Skill Check Message Component
 *
 * Shows social conflict / skill check result.
 * TODO: Customize with skill details, target, success/failure indicators.
 *
 * @module components/chat/message-types/SkillCheckMessage
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/chat/chat.module.scss';
import type { ChatMessage } from '@/types/chat';

interface SkillCheckMessageProps {
  message: ChatMessage;
  formattedTime: string;
}

export function SkillCheckMessage({ message, formattedTime }: SkillCheckMessageProps): JSX.Element {
  const skillCheck = message.socialConflict as any; // TODO: Update SkillCheckPayload type after Phase 6

  return (
    <>
      <div className={styles.messageHeader}>
        <span className={styles.skillIcon}>⚔️</span>
        <span className={styles.characterName}>{message.characterName}</span>

        {message.position && (
          <span className={styles.characterTag}>@ {message.position}</span>
        )}

        <time className={styles.messageTimestamp} dateTime={message.timestamp}>
          {formattedTime}
        </time>
      </div>

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

      {/* Fallback for old-style skill check (non-opposed) */}
      {skillCheck && !skillCheck.attackSkill && skillCheck.skill && (
        <div className={styles.skillCheckResult}>
          Skill: {skillCheck.skill} | Success: {skillCheck.success ? '✅' : '❌'}
        </div>
      )}
    </>
  );
}
