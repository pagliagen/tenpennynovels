/**
 * Action Type Selector Component
 *
 * Dropdown for selecting message action type.
 * Available actions depend on character data (skills, stats, items, roles).
 *
 * @module components/chat/ActionTypeSelector
 * @since 2.0.0
 */

'use client';

import type { ChatMessageType } from '@/types/chat';
import styles from '@/styles/components/chat/ActionTypeSelector.module.scss';

/**
 * Action Type Selector Props
 */
interface ActionTypeSelectorProps {
  /** Currently selected action type */
  selectedAction: ChatMessageType;

  /** Available action types (depends on character data) */
  availableActions: ChatMessageType[];

  /** Callback when action type changes */
  onActionChange: (action: ChatMessageType) => void;
}

/**
 * Display names for action types (Italian)
 * Note: Some action types are system-generated and not selectable by users
 */
const ACTION_DISPLAY_NAMES: Record<ChatMessageType, string> = {
  standard: 'Messaggio Standard',
  whisper: 'Sussurro',
  ooc: 'Fuori dal Gioco (OOC)',
  dice_roll: 'Tiro Dado',
  skill_check: 'Tiro Abilità',
  stat_check: 'Tiro Caratteristica',
  item_use: 'Usa Oggetto',
  master: 'Annuncio Master',
  moderation: 'Moderazione',
  // System-generated (not selectable)
  social_confrontation: '[Sistema] Conflitto Sociale',
  combat_action: '[Sistema] Azione di Combattimento',
  confrontation_reaction_request: '[Sistema] Richiesta Reazione',
};

/**
 * Action Type Selector Component
 *
 * Simple dropdown with available actions.
 *
 * @param {ActionTypeSelectorProps} props - Component props
 * @returns {JSX.Element} Action type selector
 */
export function ActionTypeSelector({
  selectedAction,
  availableActions,
  onActionChange,
}: ActionTypeSelectorProps): JSX.Element {
  return (
    <select
      value={selectedAction}
      onChange={(e) => onActionChange(e.target.value as ChatMessageType)}
      className={styles.actionTypeSelect}
    >
      {availableActions.map((action) => (
        <option key={action} value={action}>
          {ACTION_DISPLAY_NAMES[action]}
        </option>
      ))}
    </select>
  );
}
