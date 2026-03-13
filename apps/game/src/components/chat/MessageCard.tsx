/**
 * MessageCard
 *
 * Minimal router component that wraps message-type components.
 * Each message-type component contains its own complete structure and uses
 * the useMessageInteractions hook for shared logic.
 */

import { useRef } from 'react';
import type { ChatMessage } from '@/types/chat';
import { StandardMessage } from './message-types/StandardMessage';
import { WhisperMessage } from './message-types/WhisperMessage';
import { OOCMessage } from './message-types/OOCMessage';
import { MasterMessage } from './message-types/MasterMessage';
import { DiceRollMessage } from './message-types/DiceRollMessage';
import { SkillCheckMessage } from './message-types/SkillCheckMessage';
import { StatCheckMessage } from './message-types/StatCheckMessage';
import { ItemUseMessage } from './message-types/ItemUseMessage';
import { ModerationMessage } from './message-types/ModerationMessage';
import { DefenderNotification } from './message-types/DefenderNotification';
import { ReactionRequestMessage } from './message-types/ReactionRequestMessage';
import { CombatActionMessage } from './message-types/CombatActionMessage';
import styles from '@/styles/components/chat/MessageCard.module.scss';

interface MessageCardProps {
  message: ChatMessage;
  isDimmed?: boolean;
  currentCharacterId: string;
}

export function MessageCard({ message, isDimmed, currentCharacterId }: MessageCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Route to appropriate message-type component
  let component: JSX.Element;
  switch (message.actionType) {
    case 'standard':
      component = <StandardMessage message={message} currentCharacterId={currentCharacterId} />;
      break;
    case 'whisper':
      component = <WhisperMessage message={message} currentCharacterId={currentCharacterId} />;
      break;
    case 'ooc':
      component = <OOCMessage message={message} currentCharacterId={currentCharacterId} />;
      break;
    case 'master':
      component = <MasterMessage message={message} currentCharacterId={currentCharacterId} />;
      break;
    case 'moderation':
      component = <ModerationMessage message={message} currentCharacterId={currentCharacterId} />;
      break;
    case 'dice_roll':
      component = <DiceRollMessage message={message} currentCharacterId={currentCharacterId} />;
      break;
    case 'skill_check':
      if ((message as any).visibleToDefenderOnly) {
        component = <DefenderNotification message={message} currentCharacterId={currentCharacterId} />;
      } else {
        component = <SkillCheckMessage message={message} currentCharacterId={currentCharacterId} />;
      }
      break;
    case 'stat_check':
      component = <StatCheckMessage message={message} currentCharacterId={currentCharacterId} />;
      break;
    case 'item_use':
      component = <ItemUseMessage message={message} currentCharacterId={currentCharacterId} />;
      break;
    case 'confrontation_reaction_request':
      component = <ReactionRequestMessage message={message} currentCharacterId={currentCharacterId} />;
      break;
    case 'combat_action':
    case 'social_confrontation':
      component = <CombatActionMessage message={message} currentCharacterId={currentCharacterId} />;
      break;
    default:
      component = <StandardMessage message={message} currentCharacterId={currentCharacterId} />;
  }

  return (
    <div
      ref={cardRef}
      className={`${styles.messageCard} ${styles[`messageCard--${message.actionType}`]} ${isDimmed ? styles.messageCardDimmed : ''}`}
    >
      {component}
    </div>
  );
}
