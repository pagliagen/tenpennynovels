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

import { CHAT_ACTION_TYPES } from '@/config/chatActionTypes';
import styles from '@/styles/components/chat/ActionTypeSelector.module.scss';
import type { ActionType } from '@/types/chat';

/**
 * Action Type Selector Props
 */
interface ActionTypeSelectorProps {
  /** Currently selected action type */
  selectedAction: ActionType;

  /** Available action types (depends on character data) */
  availableActions: ActionType[];

  /** Callback when action type changes */
  onActionChange: (action: ActionType) => void;
}

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
      onChange={(e) => onActionChange(e.target.value as ActionType)}
      className={styles.actionTypeSelect}
    >
      {availableActions.map((action) => (
        <option key={action} value={action}>
          {CHAT_ACTION_TYPES[action].dropdownLabel}
        </option>
      ))}
    </select>
  );
}
