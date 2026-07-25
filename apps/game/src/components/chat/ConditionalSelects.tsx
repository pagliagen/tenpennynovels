/**
 * Conditional Selects Component
 *
 * Renders action-specific selects (whisper target, skill, stat, item)
 * based on selected action type.
 *
 * @module components/chat/ConditionalSelects
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/chat/ConditionalSelects.module.scss';
import type { ActionType } from '@/types/chat';

/**
 * Occupant data for whisper targets
 */
interface Occupant {
  characterId: string;
  characterName: string;
}

/**
 * Skill data
 */
interface Skill {
  name: string;
  value: number;
  category?: string;
}

/**
 * Item data
 */
interface Item {
  id: string;
  name: string;
  category?: string;
}

/**
 * Conditional Selects Props
 */
interface ConditionalSelectsProps {
  /** Selected action type */
  selectedAction: ActionType;

  /** Current character ID (to exclude from whisper targets) */
  currentCharacterId: string;

  /** Location occupants (for whisper targets) */
  occupants: Occupant[];

  /** Character skills (for skill checks) */
  skills?: Skill[];

  /** Character stats (for stat checks) */
  stats?: Record<string, number>;

  /** Character equipped items (for item use) */
  equippedItems?: Item[];

  /** Selected whisper targets */
  targetCharacters: string[];

  /** Selected skill */
  selectedSkill: string;

  /** Selected stat */
  selectedStat: string;

  /** Selected item */
  selectedItem: string;

  /** Callbacks */
  onTargetChange: (targets: string[]) => void;
  onSkillChange: (skill: string) => void;
  onStatChange: (stat: string) => void;
  onItemChange: (item: string) => void;
}

/**
 * Conditional Selects Component
 *
 * Shows appropriate selector based on action type:
 * - whisper → target character picker
 * - skill_check → skill selector
 * - stat_check → stat selector
 * - item_use → item selector
 *
 * @param {ConditionalSelectsProps} props - Component props
 * @returns {JSX.Element | null} Conditional selects or null
 */
export function ConditionalSelects({
  selectedAction,
  currentCharacterId,
  occupants,
  stats = {},
  equippedItems = [],
  targetCharacters,
  selectedStat,
  selectedItem,
  onTargetChange,
  onStatChange,
  onItemChange,
}: ConditionalSelectsProps): JSX.Element | null {
  // Whisper target selection
  if (selectedAction === 'whisper') {
    const otherOccupants = occupants.filter((occ) => occ.characterId !== currentCharacterId);

    // Defensive fallback: whisper shouldn't be selectable without other occupants
    // (see MessageInput.getAvailableActions), but handle it gracefully if it happens
    // (e.g. the last other occupant just left while the selector was open).
    if (otherOccupants.length === 0) {
      return (
        <div className={styles.conditionalSelect}>
          <span className={styles.selectInput}>Nessun altro personaggio presente per un sussurro</span>
        </div>
      );
    }

    const isWhisperGlobal = targetCharacters.length === otherOccupants.length;

    return (
      <div className={styles.conditionalSelect}>
        <select
          value={isWhisperGlobal ? 'all' : targetCharacters[0] || ''}
          onChange={(e) => {
            if (e.target.value === 'all') {
              onTargetChange(otherOccupants.map((occ) => occ.characterId));
            } else if (e.target.value) {
              onTargetChange([e.target.value]);
            } else {
              onTargetChange([]);
            }
          }}
          className={styles.selectInput}
        >
          <option value="">Seleziona Destinatario</option>
          <option value="all">Sussurro a Tutti</option>
          {otherOccupants.map((occupant) => (
            <option key={occupant.characterId} value={occupant.characterId}>
              {occupant.characterName}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Stat selection
  if (selectedAction === 'stat_check') {
    return (
      <div className={styles.conditionalSelect}>
        <select value={selectedStat} onChange={(e) => onStatChange(e.target.value)} className={styles.selectInput}>
          <option value="">Seleziona Caratteristica</option>
          {(Object.entries(stats) as [string, number][]).map(([statName, statValue]) => (
            <option key={statName} value={statName}>
              {statName} ({statValue})
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Item selection
  if (selectedAction === 'item_use') {
    return (
      <div className={styles.conditionalSelect}>
        <select value={selectedItem} onChange={(e) => onItemChange(e.target.value)} className={styles.selectInput}>
          <option value="">Seleziona Oggetto</option>
          {equippedItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} {item.category && `(${item.category})`}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // No conditional select needed for other actions
  return null;
}
