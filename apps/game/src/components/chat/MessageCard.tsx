/**
 * MessageCard
 *
 * Minimal router component that wraps message-type components.
 * Each message-type component contains its own complete structure and uses
 * the useMessageInteractions hook for shared logic.
 */

import { useRef } from 'react';

import styles from '@/styles/components/chat/MessageCard.module.scss';
import type { ChatMessage } from '@/types/chat';

import { CombatActionMessage } from './message-types/CombatActionMessage';
import { DiceRollMessage } from './message-types/DiceRollMessage';
import { ItemUseMessage } from './message-types/ItemUseMessage';
import { MasterMessage } from './message-types/MasterMessage';
import { ModerationMessage } from './message-types/ModerationMessage';
import { OOCMessage } from './message-types/OOCMessage';
import { ReactionRequestMessage } from './message-types/ReactionRequestMessage';
import { StandardMessage } from './message-types/StandardMessage';
import { StatCheckMessage } from './message-types/StatCheckMessage';
import { WhisperMessage } from './message-types/WhisperMessage';

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

  // Build className dynamically, only include type-specific style if it exists
  const typeClassName = styles[`messageCard--${message.actionType}`];
  const className = [
    styles.messageCard,
    typeClassName || '', // Only add if exists (avoid undefined)
    isDimmed ? styles.messageCardDimmed : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={cardRef} className={className}>
      {component}
    </div>
  );
}
